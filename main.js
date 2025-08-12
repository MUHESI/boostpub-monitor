const { exec, execSync } = require("child_process");
const axios = require("axios");
const fs = require('fs').promises;
const path = require('path');

const APP_NAME = "bpub-prod";
const CPU_LIMIT = 70;           // % CPU max appliqué avec cpulimit
const CPU_THRESHOLD = 90;       // Seuil déclenchement %
const RAM_THRESHOLD = 1024;      // Seuil déclenchement en Mo
const POST_URL = ""; //  https://ton-endpoint.com/api/alert<-- à remplacer

// Configuration nettoyage sessions Chrome
const SESSIONS_PATH = '/var/www/node-apps/boostpub-api/WH_SESSIONS/PROD';
const CHROME_PROCESS_NAME = 'chrome'; // ou 'chromium' selon ton install

// Variables pour le logging intelligent
let lastLogTime = 0;
let consecutiveNormalChecks = 0;
let lastCpuLimitApplied = 0;

// Fonction de logging avec timestamp
function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [WATCHDOG]`;

    switch (type) {
        case 'ERROR':
            console.error(`${prefix} ❌ ${message}`);
            break;
        case 'WARNING':
            console.warn(`${prefix} ⚠️  ${message}`);
            break;
        case 'SUCCESS':
            console.log(`${prefix} ✅ ${message}`);
            break;
        case 'ACTION':
            console.log(`${prefix} 🔥 ${message}`);
            break;
        case 'CLEANUP':
            console.log(`${prefix} 🧹 ${message}`);
            break;
        case 'STATUS':
            console.log(`${prefix} 📊 ${message}`);
            break;
        default:
            console.log(`${prefix} ℹ️  ${message}`);
    }
}

// Fonction pour exécuter une commande shell
function runCommand(cmd) {
    return execSync(cmd, { encoding: "utf8" }).trim();
}

// Appliquer limite CPU (avec logging intelligent)
function applyCpuLimit(pid) {
    const now = Date.now();
    // Log seulement si pas appliqué récemment ou si c'est la première fois
    if (now - lastCpuLimitApplied > 60000 || lastCpuLimitApplied === 0) {
        log(`Application de la limite CPU: ${CPU_LIMIT}% sur PID ${pid}`, 'ACTION');
        lastCpuLimitApplied = now;
    }

    exec(`cpulimit -p ${pid} -l ${CPU_LIMIT} --background`, (err) => {
        if (err) log(`Erreur lors de l'application de la limite CPU: ${err.message}`, 'ERROR');
    });
}

// Récupérer PID BoostPub
function getBoostPubPID() {
    try {
        return runCommand(`pm2 pid ${APP_NAME}`);
    } catch {
        return null;
    }
}

// Récupérer usage CPU/RAM
function getUsage(pid) {
    try {
        const output = runCommand(`ps -p ${pid} -o %cpu=,%mem=,rss=`);
        const [cpu, memPercent, rssKb] = output.split(/\s+/).map(v => parseFloat(v));
        const rssMb = Math.round(rssKb / 1024);
        return { cpu, memPercent, rssMb };
    } catch {
        return null;
    }
}

// Action quand seuil dépassé
async function handleThreshold(cpu, rssMb) {
    log(`🚨 SEUIL CRITIQUE DÉPASSÉ ! CPU=${cpu}% RAM=${rssMb}MB`, 'WARNING');
    log(`Déclenchement de la séquence de récupération...`, 'ACTION');

    try {
        // Étape 1: Tuer Chrome Puppeteer
        log(`Étape 1/5: Arrêt des processus Chrome Puppeteer...`, 'ACTION');
        execSync(`pkill -f "chrome.*WH_SESSIONS"`);
        log(`Processus Chrome arrêtés avec succès`, 'SUCCESS');

        // Étape 2: Stopper BoostPub
        log(`Étape 2/5: Arrêt de l'application ${APP_NAME}...`, 'ACTION');
        runCommand(`pm2 stop ${APP_NAME}`);
        await new Promise(res => setTimeout(res, 2000));
        log(`Application ${APP_NAME} arrêtée avec succès`, 'SUCCESS');

        // Étape 3: Nettoyer les sessions Chrome orphelines
        log(`Étape 3/5: Nettoyage des sessions Chrome orphelines...`, 'CLEANUP');
        try {
            const cleanReport = await cleanChromeSessions();
            log(`Nettoyage terminé: ${cleanReport.deletedFoldersCount}/${cleanReport.orphanFoldersCount} sessions supprimées`, 'SUCCESS');
        } catch (cleanError) {
            log(`Erreur lors du nettoyage des sessions: ${cleanError.message}`, 'ERROR');
        }

        // Étape 4: Redémarrer BoostPub
        log(`Étape 4/5: Redémarrage de l'application ${APP_NAME}...`, 'ACTION');
        runCommand(`pm2 start ${APP_NAME}`);
        log(`Application ${APP_NAME} redémarrée avec succès`, 'SUCCESS');

        // Étape 5: Envoyer alerte HTTP
        log(`Étape 5/5: Envoi de l'alerte HTTP...`, 'ACTION');
        await axios.post(POST_URL, {
            app: APP_NAME,
            cpu,
            ram_mb: rssMb,
            time: new Date().toISOString(),
            action: 'threshold_exceeded_restart'
        });
        log(`Alerte HTTP envoyée avec succès`, 'SUCCESS');

        log(`🎉 SÉQUENCE DE RÉCUPÉRATION TERMINÉE AVEC SUCCÈS !`, 'SUCCESS');
        log(`Résumé: CPU=${cpu}% → Limité, RAM=${rssMb}MB → Nettoyé, Sessions Chrome → Nettoyées`, 'STATUS');

    } catch (err) {
        log(`❌ ERREUR CRITIQUE lors de la séquence de récupération: ${err.message}`, 'ERROR');
        log(`L'application peut nécessiter une intervention manuelle`, 'WARNING');
    }
}

// Helper exec promisifié pour nettoyage
function execAsync(cmd) {
    return new Promise((res, rej) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) return rej(err);
            res(stdout.trim());
        });
    });
}

// Trouve tous les fichiers SingletonLock sous SESSIONS_PATH
async function findSingletonLocks() {
    const cmd = `find ${SESSIONS_PATH} -type f -name "SingletonLock"`;
    try {
        const result = await execAsync(cmd);
        return result ? result.split('\n') : [];
    } catch {
        return [];
    }
}

// Liste les dossiers des fichiers SingletonLock
function foldersFromLocks(lockFiles) {
    const folders = new Set();
    for (const filePath of lockFiles) {
        // SingletonLock est dans .../session/SingletonLock
        // on remonte de 2 niveaux pour atteindre le dossier JSON de session
        const folder = path.resolve(filePath, '../../..');
        folders.add(folder);
    }
    return Array.from(folders);
}

// Récupère les profils --user-data-dir actifs des processus Chrome
async function getActiveChromeProfiles() {
    try {
        const psCmd = `ps aux | grep ${CHROME_PROCESS_NAME} | grep -- --user-data-dir | grep -v grep`;
        const output = await execAsync(psCmd);
        if (!output) return [];

        const lines = output.split('\n');
        const profiles = new Set();

        for (const line of lines) {
            // Extrait le chemin --user-data-dir=chemin ou --user-data-dir chemin
            const match = line.match(/--user-data-dir=([^\s]+)/) || line.match(/--user-data-dir\s+([^\s]+)/);
            if (match && match[1]) profiles.add(path.resolve(match[1]));
        }
        return Array.from(profiles);
    } catch {
        return [];
    }
}

// Supprime un dossier récursivement (fs.rm avec recursive)
async function deleteFolder(folderPath) {
    try {
        await fs.rm(folderPath, { recursive: true, force: true });
        return true;
    } catch {
        return false;
    }
}

// Fonction de nettoyage des sessions Chrome
async function cleanChromeSessions() {
    log(`Recherche des fichiers SingletonLock dans ${SESSIONS_PATH}...`, 'CLEANUP');
    const lockFiles = await findSingletonLocks();
    if (lockFiles.length === 0) {
        log(`Aucun fichier SingletonLock trouvé`, 'CLEANUP');
        return {
            totalLocks: 0,
            totalLockedFolders: 0,
            activeProfilesCount: 0,
            orphanFoldersCount: 0,
            deletedFoldersCount: 0,
            deletedFolders: [],
        };
    }

    const lockedFolders = foldersFromLocks(lockFiles);
    log(`Dossiers bloqués trouvés: ${lockedFolders.length}`, 'CLEANUP');

    const activeProfiles = await getActiveChromeProfiles();
    log(`Profils Chrome actifs détectés: ${activeProfiles.length}`, 'CLEANUP');

    // Identifier dossiers orphelins (pas dans les profils actifs)
    const orphelins = lockedFolders.filter(folder => {
        return !activeProfiles.some(active => active === folder);
    });

    log(`Dossiers orphelins identifiés: ${orphelins.length}`, 'CLEANUP');

    if (orphelins.length === 0) {
        log(`Aucun dossier orphelin à supprimer`, 'SUCCESS');
        return {
            totalLocks: lockFiles.length,
            totalLockedFolders: lockedFolders.length,
            activeProfilesCount: activeProfiles.length,
            orphanFoldersCount: 0,
            deletedFoldersCount: 0,
            deletedFolders: [],
        };
    }

    // Suppression
    log(`Début de la suppression de ${orphelins.length} dossiers orphelins...`, 'CLEANUP');
    const results = [];
    for (const folder of orphelins) {
        const success = await deleteFolder(folder);
        results.push({ folder, deleted: success });
        if (success) {
            log(`✓ Supprimé: ${path.basename(folder)}`, 'CLEANUP');
        } else {
            log(`✗ Échec suppression: ${path.basename(folder)}`, 'ERROR');
        }
    }

    const deletedCount = results.filter(r => r.deleted).length;
    log(`Nettoyage terminé: ${deletedCount}/${orphelins.length} dossiers supprimés avec succès`, 'SUCCESS');

    return {
        totalLocks: lockFiles.length,
        totalLockedFolders: lockedFolders.length,
        activeProfilesCount: activeProfiles.length,
        orphanFoldersCount: orphelins.length,
        deletedFoldersCount: deletedCount,
        deletedFolders: results.filter(r => r.deleted).map(r => r.folder),
    };
}

// Boucle principale avec logging intelligent
async function main() {
    log(`🚀 Démarrage du watchdog pour ${APP_NAME}`, 'SUCCESS');
    log(`Configuration: CPU Threshold=${CPU_THRESHOLD}%, RAM Threshold=${RAM_THRESHOLD}MB, CPU Limit=${CPU_LIMIT}%`, 'STATUS');
    log(`Surveillance active - vérification toutes les 5 secondes`, 'STATUS');

    setInterval(() => {
        const pid = getBoostPubPID();
        if (!pid || pid === "0") {
            log(`Application ${APP_NAME} non trouvée ou arrêtée`, 'WARNING');
            return;
        }

        // Limite CPU
        applyCpuLimit(pid);

        // Mesurer usage
        const usage = getUsage(pid);
        if (!usage) {
            log(`Impossible de récupérer les métriques pour PID ${pid}`, 'ERROR');
            return;
        }

        // Logging intelligent pour les métriques normales
        const now = Date.now();
        const timeSinceLastLog = now - lastLogTime;

        // Log détaillé seulement toutes les 30 secondes ou si valeurs élevées
        if (timeSinceLastLog > 30000 || usage.cpu > CPU_THRESHOLD * 0.7 || usage.rssMb > RAM_THRESHOLD * 0.7) {
            log(`Métriques: CPU=${usage.cpu.toFixed(1)}% RAM=${usage.rssMb}MB (PID: ${pid})`, 'STATUS');
            lastLogTime = now;
            consecutiveNormalChecks = 0;
        } else {
            consecutiveNormalChecks++;
            // Log résumé toutes les 2 minutes si tout va bien
            if (consecutiveNormalChecks % 24 === 0) { // 24 * 5s = 2 minutes
                log(`Surveillance active - ${consecutiveNormalChecks} vérifications normales consécutives`, 'INFO');
            }
        }

        // Vérifier seuils
        if (usage.cpu > CPU_THRESHOLD || usage.rssMb > RAM_THRESHOLD) {
            log(`⚠️  SEUIL APPROCHÉ: CPU=${usage.cpu.toFixed(1)}% RAM=${usage.rssMb}MB`, 'WARNING');
            handleThreshold(usage.cpu, usage.rssMb);
        }
    }, 5000); // check toutes les 5 secondes
}

main();
