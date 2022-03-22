// Generated using webpack-cli https://github.com/webpack/webpack-cli

const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const isProduction = process.env.NODE_ENV == "production";

const config = {
    entry: "./pkg/dist-src/index.js",
    module: {
        rules: [
            {
                test: /\.m?js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
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
        experiments: {
            outputModule: true,
        },
        output: {
            path: path.resolve(__dirname, "dist"),
            filename: 'rdkit-structure-renderer-module.js',
            library: {
                type: 'module',
            },
        },
    };

    const scriptConfig = {
        ...config,
        resolve: {
            alias: {
                './StructureRenderer/Renderer': '/src/StructureRenderer/Renderer',
            },
        },
        output: {
            path: path.resolve(__dirname, "dist"),
            filename: 'rdkit-structure-renderer-bundle.js',
        },
        devServer: {
            static: {
                directory: path.resolve(__dirname),
            },
            open: true,
            server: 'https',
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
