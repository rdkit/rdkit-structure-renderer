// Generated using webpack-cli https://github.com/webpack/webpack-cli

const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { version } = require("./package.json");
const { DefinePlugin } = require("webpack");

const isProduction = process.env.NODE_ENV == "production";

const config = {
    module: {
        rules: [
            {
                test: /\.m?js$/,
                exclude: [
                    /node_modules/,
                    /\bcore-js\b/
                ],
                use: {
                    loader: "babel-loader",
                    options: {
                        configFile: path.resolve(__dirname, "babel.config.js"),
                        presets: ["@babel/preset-env"]
                    }
                }
            },
            {
                test: /\.(eot|svg|ttf|woff|woff2|png|jpg|gif)$/i,
                type: "asset",
            },
        ],
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        publicPath: ""
    },
    devtool: "source-map",
    plugins: [
        new DefinePlugin({
            PKG_VERSION: `'${version}'`,
            // MINIMALLIB_PATH is relative to the src/StructureRenderer directory,
            // which is where Renderer.js (which references MINIMALLIB_PATH) lives
            MINIMALLIB_PATH: `'${path.join("..", "..", "public", `RDKit_minimal.${version}.js`)}'`,
        }),
    ],
};

module.exports = () => {
    if (isProduction) {
        config.mode = "production";
    } else {
        config.mode = "development";
    }

    const moduleConfig = {
        ...config,
        entry: {
            main: [
                "core-js/stable",
                "./src/index.js"
            ]
        },
        experiments: {
            outputModule: true,
        },
        output: {
            filename: "rdkit-structure-renderer-module.js",
            library: {
                type: "module",
            },
        },
    };

    const umdConfig = {
        ...config,
        entry: {
            main: [
                "core-js/stable",
                "./src/index.js"
            ]
        },
        output: {
            filename: "rdkit-structure-renderer-umd.js",
            library: {
                type: "umd",
            },
        },
    };

    const scriptConfig = {
        ...config,
        entry: {
            app: [
                "core-js/stable",
                "./src/bundle.js"
            ]
        },
        target: ["web", "es5"],
        output: {
            filename: "rdkit-structure-renderer-bundle.js",
        },
        devServer: {
            static: {
                directory: path.resolve(__dirname),
            },
            open: true,
            server: "https",
            host: "localhost",
            port: 7800,
        },
        plugins: [ ...config.plugins,
            new HtmlWebpackPlugin({
                template: "index.html",
            }),
        ],
    };

    const nodeConfig = {
        ...config,
        entry: {
            app: [
                "core-js/stable",
                "./src/index.js"
            ]
        },
        target: "node",
        output: {
            filename: "rdkit-structure-renderer-node.js",
            libraryTarget: "commonjs2",
        },
    };

    return [ scriptConfig, moduleConfig, nodeConfig, umdConfig ];
};
