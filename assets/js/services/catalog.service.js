const CatalogService = (() => {
    const BAREMETAL_BUNDLES = [
        { bundleId: 'fabric-1.20.1',           modLoader: 'fabric',   minecraftVersion: '1.20.1', modLoaderVersion: '1.20.1', fileName: 'fabric-1.20.1.tar.gz' },
        { bundleId: 'fabric-1.20.4',           modLoader: 'fabric',   minecraftVersion: '1.20.4', modLoaderVersion: '1.20.4', fileName: 'fabric-1.20.4.tar.gz' },
        { bundleId: 'fabric-1.21.1',           modLoader: 'fabric',   minecraftVersion: '1.21.1', modLoaderVersion: '1.21.1', fileName: 'fabric-1.21.1.tar.gz' },
        { bundleId: 'forge-1.20.1-47.3.0',     modLoader: 'forge',    minecraftVersion: '1.20.1', modLoaderVersion: '47.3.0', fileName: 'forge-1.20.1-47.3.0.tar.gz' },
        { bundleId: 'forge-1.20.2-48.1.0',     modLoader: 'forge',    minecraftVersion: '1.20.2', modLoaderVersion: '48.1.0', fileName: 'forge-1.20.2-48.1.0.tar.gz' },
        { bundleId: 'forge-1.20.4-49.0.49',    modLoader: 'forge',    minecraftVersion: '1.20.4', modLoaderVersion: '49.0.49', fileName: 'forge-1.20.4-49.0.49.tar.gz' },
        { bundleId: 'neoforge-20.4.248',       modLoader: 'neoforge', minecraftVersion: '1.20.4', modLoaderVersion: '20.4.248', fileName: 'neoforge-20.4.248.tar.gz' },
        { bundleId: 'neoforge-21.1.172',       modLoader: 'neoforge', minecraftVersion: '1.21.1', modLoaderVersion: '21.1.172', fileName: 'neoforge-21.1.172.tar.gz' },
        { bundleId: 'neoforge-21.4.111-beta',  modLoader: 'neoforge', minecraftVersion: '1.21.4', modLoaderVersion: '21.4.111-beta', fileName: 'neoforge-21.4.111-beta.tar.gz' },
        { bundleId: 'paper-1.20.1',            modLoader: 'paper',    minecraftVersion: '1.20.1', modLoaderVersion: '1.20.1', fileName: 'paper-1.20.1.tar.gz' },
        { bundleId: 'paper-1.20.4',            modLoader: 'paper',    minecraftVersion: '1.20.4', modLoaderVersion: '1.20.4', fileName: 'paper-1.20.4.tar.gz' },
        { bundleId: 'paper-1.21.1',            modLoader: 'paper',    minecraftVersion: '1.21.1', modLoaderVersion: '1.21.1', fileName: 'paper-1.21.1.tar.gz' },
    ];

    // Оставляем список версий Minecraft как был раньше.
    const DOCKER_VERSION_ORDER = [
        '1.21.11', '1.21.10', '1.21.9', '1.21.8', '1.21.7', '1.21.6', '1.21.5', '1.21.4',
        '1.21.3', '1.21.2', '1.21.1', '1.21', '1.20.6', '1.20.5', '1.20.4', '1.20.2', '1.20.1'
    ];

    // Paper оставляем доступным на тех же версиях Minecraft, но без latest в UI.
    // Для Paper отдельной «версии модлоадера» по сути нет, поэтому показываем конкретную ветку MC.
    const PAPER_VERSION_BRANCHES = [
        '1.21.11', '1.21.10', '1.21.9', '1.21.8', '1.21.7', '1.21.6', '1.21.5', '1.21.4',
        '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.5', '1.20.4', '1.20.2', '1.20.1'
    ];

    // Для Fabric можно безопасно дать 3 последних loader-версии.
    const FABRIC_LOADER_VERSIONS = ['0.18.5', '0.18.4', '0.18.3'];

    // Для Forge даем до 3 конкретных версий под каждую ветку Minecraft.
    const FORGE_VERSION_MAP = {
        '1.20.1': ['47.4.18', '47.4.10', '47.3.0'],
        '1.20.2': ['48.1.0', '48.0.49', '48.0.48'],
        '1.20.4': ['49.2.7', '49.2.0', '49.0.49'],
        '1.20.6': ['50.2.8', '50.2.7', '50.2.6'],
        '1.21':   ['51.0.33', '51.0.32', '51.0.31'],
        '1.21.1': ['52.1.14', '52.1.13', '52.1.12'],
        '1.21.3': ['53.1.10', '53.1.9', '53.1.7'],
        '1.21.4': ['54.1.16', '54.1.15', '54.1.14'],
        '1.21.5': ['55.1.10', '55.1.9', '55.1.8'],
        '1.21.6': ['56.0.9', '56.0.8', '56.0.7'],
        '1.21.7': ['57.0.3', '57.0.2', '57.0.1'],
        '1.21.8': ['58.1.18', '58.1.17', '58.1.16'],
        '1.21.9': ['59.0.5', '59.0.4', '59.0.3'],
        '1.21.10': ['60.1.9', '60.1.8', '60.1.7'],
        '1.21.11': ['61.1.5', '61.1.4', '61.1.3'],
    };

    // Для NeoForge тоже до 3 конкретных версий, только там, где есть уверенная ветка.
    const NEOFORGE_VERSION_MAP = {
        '1.20.4': ['20.4.251', '20.4.250', '20.4.249'],
        '1.20.6': ['20.6.139', '20.6.138', '20.6.137'],
        '1.21': ['21.0.167', '21.0.166', '21.0.165'],
        '1.21.1': ['21.1.189', '21.1.188', '21.1.187'],
        '1.21.3': ['21.3.83', '21.3.82', '21.3.81'],
        '1.21.4': ['21.4.125', '21.4.124', '21.4.123'],
        '1.21.5': ['21.5.96', '21.5.95', '21.5.94'],
        '1.21.6': ['21.6.18-beta', '21.6.17-beta', '21.6.16-beta'],
        '1.21.7': ['21.7.24-beta', '21.7.23-beta', '21.7.22-beta'],
        '1.21.8': ['21.8.51', '21.8.50', '21.8.49'],
        '1.21.9': ['21.9.16-beta', '21.9.15-beta', '21.9.14-beta'],
        '1.21.10': ['21.10.64', '21.10.63', '21.10.62-beta'],
        '1.21.11': ['21.11.29-beta', '21.11.28-beta', '21.11.27-beta'],
    };

    function _pushOptionsFromMap(target, modLoader, versionMap) {
        Object.entries(versionMap).forEach(([minecraftVersion, loaderVersions]) => {
            loaderVersions.forEach(modLoaderVersion => {
                target.push({ minecraftVersion, modLoader, modLoaderVersion });
            });
        });
    }

    function _pushManyVersions(target, versions, modLoader, loaderVersions) {
        versions.forEach(minecraftVersion => {
            loaderVersions.forEach(modLoaderVersion => {
                target.push({ minecraftVersion, modLoader, modLoaderVersion });
            });
        });
    }

    const DOCKER_OPTIONS = [];

    // Paper
    PAPER_VERSION_BRANCHES.forEach(version => {
        DOCKER_OPTIONS.push({
            minecraftVersion: version,
            modLoader: 'paper',
            modLoaderVersion: version
        });
    });

    // Fabric
    _pushManyVersions(DOCKER_OPTIONS, DOCKER_VERSION_ORDER, 'fabric', FABRIC_LOADER_VERSIONS);

    // Forge
    _pushOptionsFromMap(DOCKER_OPTIONS, 'forge', FORGE_VERSION_MAP);

    // NeoForge
    _pushOptionsFromMap(DOCKER_OPTIONS, 'neoforge', NEOFORGE_VERSION_MAP);

    async function getBaremetalBundles() {
        return BAREMETAL_BUNDLES;
    }

    async function getDockerOptions() {
        return DOCKER_OPTIONS;
    }

    function getUniqueVersions(options) {
        return [...new Set(options.map(o => o.minecraftVersion))]
            .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    }

    function getLoadersForVersion(options, version) {
        const priority = ['paper', 'neoforge', 'forge', 'fabric'];
        return [...new Set(options
            .filter(o => o.minecraftVersion === version)
            .map(o => o.modLoader))]
            .sort((a, b) => {
                const ai = priority.indexOf(a);
                const bi = priority.indexOf(b);
                if (ai === -1 && bi === -1) return a.localeCompare(b);
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
            });
    }

    function getLoaderVersions(options, version, loader) {
        return [...new Set(options
            .filter(o => o.minecraftVersion === version && o.modLoader === loader)
            .map(o => o.modLoaderVersion))];
    }

    return {
        getBaremetalBundles,
        getDockerOptions,
        getUniqueVersions,
        getLoadersForVersion,
        getLoaderVersions
    };
})();
