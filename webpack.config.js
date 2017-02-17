const path = require("path");
const webpack = require("webpack");
const CircularDependencyPlugin = require("circular-dependency-plugin");
const StringReplacePlugin = require("string-replace-webpack-plugin");

module.exports = {
    entry: {
        main: "./main.js",
    },
    output: {
      // path: path.resolve(__dirname, './dist'),
        filename: "[name].bundle.js",
        strictModuleExceptionHandling: true
    },
    module: {
        rules: [
            // { 
            //     test: /prototypejs\/dist\/prototype$/,
            //     use: [
            //         {
            //             loader: "exports-loader",
            //             options: "Class",
            //         },
            //         {
            //             loader: "imports-loader",
            //             options: "this=>window",
            //         },
            //     ],
            // },
            { 
                test: /\.js$/,
                exclude: /node_modules|bower_components/,
                loader: "babel-loader"
            }
        ]
    },
    resolve: {
        modules: ['src', 'node_modules', 'bower_components', 'public/js'],
        // alias : {
        //     xwiki: "dist/xwiki-min.js"
        // }
      // modules: ["js", ],
      // descriptionFiles: ["package.json", "bower.json"],
      // mainFields: ["main", "browser"],
    },
    devServer: {
        proxy: {
            '/patient/**': {
                target: 'http://localhost:8000',
                secure: false,
            },
        },
    },
    devtool: 'source-map',
    plugins: [
        new webpack.ProvidePlugin({
            jquery: "jquery",
            Raphael: "raphael",
            Sizzle: "sizzle",
            Class: "imports-loader?this=>window!exports-loader?Class!prototypejs/dist/prototype",
            Prototype: "imports-loader?this=>window!exports-loader?Prototype!prototypejs/dist/prototype",
            Enumerable: "imports-loader?this=>window!exports-loader?Enumerable!prototypejs/dist/prototype",
            $H: "imports-loader?this=>window!exports-loader?$H!prototypejs/dist/prototype",
            $w: "imports-loader?this=>window!exports-loader?$w!prototypejs/dist/prototype",
            $R: "imports-loader?this=>window!exports-loader?$R!prototypejs/dist/prototype",
            // Ajax: "imports-loader?this=>window!exports-loader?Ajax!prototypejs/dist/prototype",
            "window.Effect": "effects",
        }),
        new CircularDependencyPlugin({
            // exclude detection of files based on a RegExp
            exclude: /bower_components|node_modules/,
            // add errors to webpack instead of warnings
            failOnError: true
        })
    ]
};
