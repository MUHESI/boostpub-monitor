const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

const SESSIONS_PATH = '/var/www/node-apps/boostpub-api/WH_SESSIONS/PROD';
const CHROME_PROCESS_NAME = 'chrome'; // ou 'chromium' selon ton install
const HTTP_REPORT_ENDPOINT = ''; // <-- mets ton endpoint ici ou laisse vide

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
    console.log('Recherche des fichiers SingletonLock...');
    const lockFiles = await findSingletonLocks();
    if (lockFiles.length === 0) {
        console.log('Aucun fichier SingletonLock trouvé.');
        return;
    }

    const lockedFolders = foldersFromLocks(lockFiles);
    console.log(`Dossiers bloqués trouvés : ${lockedFolders.length}`);

    const activeProfiles = await getActiveChromeProfiles();
    console.log(`Profils Chrome actifs détectés : ${activeProfiles.length}`);

    // Identifier dossiers orphelins (pas dans les profils actifs)
    const orphelins = lockedFolders.filter(folder => {
        return !activeProfiles.some(active => active === folder);
    });

    console.log(`Dossiers orphelins à supprimer : ${orphelins.length}`);

    // Suppression
    const results = [];
    for (const folder of orphelins) {
        const success = await deleteFolder(folder);
        results.push({ folder, deleted: success });
        console.log(`${success ? 'Supprimé:' : 'Échec suppression:'} ${folder}`);
    }

    // Rapport résumé
    const report = {
        timestamp: new Date().toISOString(),
        totalLocks: lockFiles.length,
        totalLockedFolders: lockedFolders.length,
        activeProfilesCount: activeProfiles.length,
        orphanFoldersCount: orphelins.length,
        deletedFoldersCount: results.filter(r => r.deleted).length,
        deletedFolders: results.filter(r => r.deleted).map(r => r.folder),
    };

    console.log('\n=== Rapport résumé ===');
    console.log(JSON.stringify(report, null, 2));

    // Envoi HTTP (optionnel)
    if (HTTP_REPORT_ENDPOINT) {
        try {
            await axios.post(HTTP_REPORT_ENDPOINT, report);
            console.log(`Rapport envoyé à ${HTTP_REPORT_ENDPOINT}`);
        } catch (e) {
            console.error(`Erreur envoi rapport HTTP : ${e.message}`);
        }
    }
}

main().catch(e => {
    console.error('Erreur dans le script:', e);
    process.exit(1);
});
