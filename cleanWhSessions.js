const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

const SESSIONS_PATH = '/var/www/node-apps/boostpub-api/WH_SESSIONS/PROD';
const CHROME_PROCESS_NAME = 'chrome'; // ou 'chromium' selon ton install
const HTTP_REPORT_ENDPOINT = ''; // <-- mets ton endpoint ici ou laisse vide

// Fonction de logging avec timestamp
function log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [CLEANUP]`;

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

// Helper exec promisifié
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

// Fonction principale
async function main() {
    log(`🚀 Démarrage du nettoyage des sessions Chrome`, 'SUCCESS');
    log(`Répertoire cible: ${SESSIONS_PATH}`, 'STATUS');

    log(`Recherche des fichiers SingletonLock...`, 'CLEANUP');
    const lockFiles = await findSingletonLocks();
    if (lockFiles.length === 0) {
        log(`Aucun fichier SingletonLock trouvé - rien à nettoyer`, 'SUCCESS');
        return;
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
        log(`Aucun dossier orphelin à supprimer - tout est propre`, 'SUCCESS');
        return;
    }

    // Suppression
    log(`Début de la suppression de ${orphelins.length} dossiers orphelins...`, 'ACTION');
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

    // Rapport résumé
    const report = {
        timestamp: new Date().toISOString(),
        totalLocks: lockFiles.length,
        totalLockedFolders: lockedFolders.length,
        activeProfilesCount: activeProfiles.length,
        orphanFoldersCount: orphelins.length,
        deletedFoldersCount: deletedCount,
        deletedFolders: results.filter(r => r.deleted).map(r => r.folder),
    };

    log(`📊 RAPPORT FINAL:`, 'STATUS');
    log(`  • Fichiers SingletonLock: ${report.totalLocks}`, 'STATUS');
    log(`  • Dossiers bloqués: ${report.totalLockedFolders}`, 'STATUS');
    log(`  • Profils Chrome actifs: ${report.activeProfilesCount}`, 'STATUS');
    log(`  • Dossiers orphelins: ${report.orphanFoldersCount}`, 'STATUS');
    log(`  • Dossiers supprimés: ${report.deletedFoldersCount}`, 'STATUS');

    // Envoi HTTP (optionnel)
    if (HTTP_REPORT_ENDPOINT) {
        try {
            log(`Envoi du rapport à ${HTTP_REPORT_ENDPOINT}...`, 'ACTION');
            await axios.post(HTTP_REPORT_ENDPOINT, report);
            log(`Rapport envoyé avec succès`, 'SUCCESS');
        } catch (e) {
            log(`Erreur lors de l'envoi du rapport HTTP: ${e.message}`, 'ERROR');
        }
    } else {
        log(`Aucun endpoint HTTP configuré - rapport non envoyé`, 'INFO');
    }

    log(`🎉 NETTOYAGE TERMINÉ AVEC SUCCÈS !`, 'SUCCESS');
}

main().catch(e => {
    log(`❌ ERREUR CRITIQUE dans le script: ${e.message}`, 'ERROR');
    process.exit(1);
});
