const { exec, execSync } = require("child_process");
const axios = require("axios");
const fs = require('fs').promises;
const path = require('path');

const APP_NAME = "bpub-prod";
const CPU_LIMIT = 50;           // % CPU max appliqué avec cpulimit
const CPU_THRESHOLD = 80;       // Seuil déclenchement %
const RAM_THRESHOLD = 450;      // Seuil déclenchement en Mo
const POST_URL = "https://ton-endpoint.com/api/alert"; // <-- à remplacer

// Configuration nettoyage sessions Chrome
const SESSIONS_PATH = '/var/www/node-apps/boostpub-api/WH_SESSIONS/PROD';
const CHROME_PROCESS_NAME = 'chrome'; // ou 'chromium' selon ton install

// Fonction pour exécuter une commande shell
function runCommand(cmd) {
    return execSync(cmd, { encoding: "utf8" }).trim();
}

// Appliquer limite CPU
function applyCpuLimit(pid) {
    console.log(`[WATCHDOG] Application limite CPU: ${CPU_LIMIT}%`);
    exec(`cpulimit -p ${pid} -l ${CPU_LIMIT} --background`, (err) => {
        if (err) console.error("[WATCHDOG] Erreur cpulimit:", err.message);
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
    console.log(`[WATCHDOG] Seuil dépassé ! CPU=${cpu}% RAM=${rssMb}MB`);

    try {
        // Tuer Chrome Puppeteer
        execSync(`pkill -f "chrome.*WH_SESSIONS"`);

        // Stopper BoostPub
        runCommand(`pm2 stop ${APP_NAME}`);
        await new Promise(res => setTimeout(res, 2000));

        // Nettoyer les sessions Chrome orphelines
        console.log("[WATCHDOG] Nettoyage des sessions Chrome...");
        try {
            const cleanReport = await cleanChromeSessions();
            console.log("[WATCHDOG] Nettoyage des sessions terminé");
        } catch (cleanError) {
            console.error("[WATCHDOG] Erreur lors du nettoyage:", cleanError.message);
        }

        // Redémarrer BoostPub
        runCommand(`pm2 start ${APP_NAME}`);

        // Envoyer alerte HTTP
        await axios.post(POST_URL, {
            app: APP_NAME,
            cpu,
            ram_mb: rssMb,
            time: new Date().toISOString()
        });

        console.log("[WATCHDOG] Redémarrage + alerte envoyée !");
    } catch (err) {
        console.error("[WATCHDOG] Erreur action seuil:", err.message);
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
    console.log('[WATCHDOG] Recherche des fichiers SingletonLock...');
    const lockFiles = await findSingletonLocks();
    if (lockFiles.length === 0) {
        console.log('[WATCHDOG] Aucun fichier SingletonLock trouvé.');
        return;
    }

    const lockedFolders = foldersFromLocks(lockFiles);
    console.log(`[WATCHDOG] Dossiers bloqués trouvés : ${lockedFolders.length}`);

    const activeProfiles = await getActiveChromeProfiles();
    console.log(`[WATCHDOG] Profils Chrome actifs détectés : ${activeProfiles.length}`);

    // Identifier dossiers orphelins (pas dans les profils actifs)
    const orphelins = lockedFolders.filter(folder => {
        return !activeProfiles.some(active => active === folder);
    });

    console.log(`[WATCHDOG] Dossiers orphelins à supprimer : ${orphelins.length}`);

    // Suppression
    const results = [];
    for (const folder of orphelins) {
        const success = await deleteFolder(folder);
        results.push({ folder, deleted: success });
        console.log(`[WATCHDOG] ${success ? 'Supprimé:' : 'Échec suppression:'} ${folder}`);
    }

    const deletedCount = results.filter(r => r.deleted).length;
    console.log(`[WATCHDOG] Nettoyage terminé: ${deletedCount}/${orphelins.length} dossiers supprimés`);

    return {
        totalLocks: lockFiles.length,
        totalLockedFolders: lockedFolders.length,
        activeProfilesCount: activeProfiles.length,
        orphanFoldersCount: orphelins.length,
        deletedFoldersCount: deletedCount,
        deletedFolders: results.filter(r => r.deleted).map(r => r.folder),
    };
}

// Boucle principale
async function main() {
    console.log("[WATCHDOG] Démarrage surveillance BoostPub...");

    setInterval(() => {
        const pid = getBoostPubPID();
        if (!pid || pid === "0") {
            console.log("[WATCHDOG] BoostPub non trouvé.");
            return;
        }

        // Limite CPU
        applyCpuLimit(pid);

        // Mesurer usage
        const usage = getUsage(pid);
        if (!usage) return;

        console.log(`[WATCHDOG] CPU=${usage.cpu}% RAM=${usage.rssMb}MB`);

        // Vérifier seuils
        if (usage.cpu > CPU_THRESHOLD || usage.rssMb > RAM_THRESHOLD) {
            handleThreshold(usage.cpu, usage.rssMb);
        }
    }, 5000); // check toutes les 5 secondes
}

main();
