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

    const DOCKER_OPTIONS = [
        { minecraftVersion: '1.21.1', modLoader: 'paper',    modLoaderVersion: '1.21.1' },
        { minecraftVersion: '1.21.1', modLoader: 'neoforge', modLoaderVersion: '21.1.172' },
        { minecraftVersion: '1.21.1', modLoader: 'fabric',   modLoaderVersion: '1.21.1' },
        { minecraftVersion: '1.20.4', modLoader: 'paper',    modLoaderVersion: '1.20.4' },
        { minecraftVersion: '1.20.4', modLoader: 'neoforge', modLoaderVersion: '20.4.248' },
        { minecraftVersion: '1.20.4', modLoader: 'forge',    modLoaderVersion: '49.0.49' },
        { minecraftVersion: '1.20.4', modLoader: 'fabric',   modLoaderVersion: '1.20.4' },
        { minecraftVersion: '1.20.1', modLoader: 'paper',    modLoaderVersion: '1.20.1' },
        { minecraftVersion: '1.20.1', modLoader: 'forge',    modLoaderVersion: '47.3.0' },
        { minecraftVersion: '1.20.1', modLoader: 'fabric',   modLoaderVersion: '1.20.1' },
    ];

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
        return [...new Set(options
            .filter(o => o.minecraftVersion === version)
            .map(o => o.modLoader))];
    }

    function getLoaderVersions(options, version, loader) {
        return options
            .filter(o => o.minecraftVersion === version && o.modLoader === loader)
            .map(o => o.modLoaderVersion);
    }

    return {
        getBaremetalBundles,
        getDockerOptions,
        getUniqueVersions,
        getLoadersForVersion,
        getLoaderVersions
    };
})();
