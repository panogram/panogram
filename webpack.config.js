const path = require("path");
const webpack = require("webpack");
const CircularDependencyPlugin = require("circular-dependency-plugin");

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
        modules: ['src', 'bower_components', 'node_modules', 'public/js'],
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
            jQuery: "jquery",
            Raphael: "raphael",
            Sizzle: "sizzle",
            Prototype: "imports-loader?this=>window!exports-loader?Prototype!prototypejs/dist/prototype",
            Enumerable: "imports-loader?this=>window!exports-loader?Enumerable!prototypejs/dist/prototype",
            $H: "imports-loader?this=>window!exports-loader?$H!prototypejs/dist/prototype",
            $w: "imports-loader?this=>window!exports-loader?$w!prototypejs/dist/prototype",
            $R: "imports-loader?this=>window!exports-loader?$R!prototypejs/dist/prototype",
            // Class: "imports-loader?this=>window!exports-loader?Class!prototypejs/dist/prototype",
            // Prototype: "imports-loader?this=>window!exports-loader?Prototype!prototypejs/dist/prototype",
            // Enumerable: "imports-loader?this=>window!exports-loader?Enumerable!prototypejs/dist/prototype",
            // $H: "imports-loader?this=>window!exports-loader?$H!prototypejs/dist/prototype",
            // $w: "imports-loader?this=>window!exports-loader?$w!prototypejs/dist/prototype",
            // $R: "imports-loader?this=>window!exports-loader?$R!prototypejs/dist/prototype",
            // Ajax: "imports-loader?this=>window!exports-loader?Ajax!prototypejs/dist/prototype",
            // Prototype: "imports-loader?Object=>window.Object!exports-loader?Prototype!prototype/src/prototype/prototype",
            // Element: "imports-loader?this=>window!exports-loader?Element!prototypejs/dist/prototype",
            // Object: "imports-loader?Object=>window.Object!exports-loader?Object!prototype/src/prototype/lang/object",
            // $w: "shim",
            // Enumerable: "exports-loader?Enumerable!prototype/src/prototype/lang/enumerable",
            "window.Effect": "effects",
        }),
        new CircularDependencyPlugin({
            // exclude detection of files based on a RegExp
            exclude: /bower_components|node_modules/,
            // add errors to webpack instead of warnings
            // failOnError: true
        })
    ]
};
