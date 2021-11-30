const ForkTsCheckerPlugin = require('fork-ts-checker-webpack-plugin');
const NodemonPlugin = require('nodemon-webpack-plugin');
const path = require('path');

module.exports = {
    mode : process.env.NODE_ENV || 'production',
    target: 'node',
    entry: './src/index.ts',
    resolve:{
        extensions: ['.ts','.js','.json'],
        mainFields: ["main"],
    },
    stats: 'errors-only',
    module:{
        rules:[
            {
                test: /\.(js|ts)?$/,
                loader: 'esbuild-loader',
                options: {
                    loader : 'tsx',
                    target: 'esnext'
                },
                exclude : /node_modules/,
            }
        ]
    },
    plugins: [new NodemonPlugin(), new ForkTsCheckerPlugin()],
    output: {
        filename: 'app.js',
        path : path.resolve(__dirname, 'dist')
    }
};