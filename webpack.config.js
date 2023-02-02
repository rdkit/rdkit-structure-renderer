// Generated using webpack-cli https://github.com/webpack/webpack-cli

const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

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
            app: [
                "core-js/stable",
                "./pkg/dist-src/index.js"
            ]
        },
        experiments: {
            outputModule: true,
        },
        output: {
            path: path.resolve(__dirname, "dist"),
            publicPath: "",
            filename: "rdkit-structure-renderer-module.js",
            library: {
                type: "module",
            },
        },
    };

    const scriptConfig = {
        ...config,
        entry: {
            app: [
                "core-js/stable",
                "./pkg/dist-src/bundle.js"
            ]
        },
        target: ["web", "es5"],
        output: {
            path: path.resolve(__dirname, "dist"),
            publicPath: "",
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
        plugins: [
            new HtmlWebpackPlugin({
                template: "index.html",
            }),
        ],
    };

    return [ scriptConfig, moduleConfig ];
};
