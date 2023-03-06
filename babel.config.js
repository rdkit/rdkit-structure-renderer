module.exports = function (api) {
    api.cache(false);
    const sourceType = "unambiguous";
    const presets = [
        [
            "@babel/preset-env",
            {
                corejs: {
                    version: "3"
                },
                useBuiltIns: "usage",
                targets: {
                    browsers: ["ie >= 11"]
                }
            }
        ]
    ];
    return {
        sourceType,
        presets,
    };
};