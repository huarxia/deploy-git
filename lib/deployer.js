'use strict';
var pathFn = require('path');
var fs = require('hexo-fs');
var chalk = require('chalk');
var swig = require('swig');
var moment = require('moment');
var Promise = require('bluebird');
var spawn = require('hexo-util/lib/spawn');
var parseConfig = require('./parse-config');

var swigHelpers = {
    now: function(format) {
        return moment().format(format);
    }
};

module.exports = function(args) {
    if (!args.repo) {
        var help = '';
        help += 'You have to configure the deployment settings in package.json first!\n\n';
        help += '{\n';
        help += '  deploy: {\n';
        help += '    type: git\n';
        help += '    repo: <repository url>\n';
        help += '    branch: [branch]\n';
        help += '    dir: [directory]\n';
        help += '  }\n';
        help += '}';

        console.log(chalk.yellow(help));
        return;
    }
    var baseDir = pathFn.join(process.cwd(), '');
    // 需要遠程push的文件夾名稱
    var dirName = args.dir;
    if (!dirName) {
        dirName = '/**/*';
    }
    var deployDir = '.deploy_git';
    deployDir = pathFn.join(baseDir, deployDir);
    var publicDir = pathFn.join(baseDir, dirName);
    var extendDirs = args.extend_dirs;
    var message = commitMessage(args);
    // var verbose = !args.silent;

    function git() {
        var len = arguments.length;
        var args = new Array(len);

        for (var i = 0; i < len; i++) {
            args[i] = arguments[i];
        }
        return spawn('git', args, {
            cwd: deployDir
        });
    }

    function setup() {
        var userName = args.name || args.user || args.userName || '';
        var userEmail = args.email || args.userEmail || '';

        // Create a placeholder for the first commit
        return fs.writeFile(pathFn.join(deployDir, 'placeholder'), '').then(function() {
            return git('init');
        }).then(function() {
            return userName && git('config', 'user.name', userName);
        }).then(function() {
            return userEmail && git('config', 'user.email', userEmail);
        }).then(function() {
            return git('add', '-A');
        }).then(function() {
            return git('commit', '-m', 'First commit');
        });
    }

    function push(repo) {
        return git('add', '-A').then(function() {
            return git('commit', '-m', message).catch(function() {
                // Do nothing. It's OK if nothing to commit.
            });
        }).then(function() {
            return git('push', '-u', repo.url, 'HEAD:' + repo.branch, '--force');
        }).then(function(o, s) {
            console.log(chalk.yellow(o));
            console.log(chalk.green('Push files is succeed...\n'));
            console.log(chalk.magenta('bye bye:)'));
        });
    }
    return fs.exists(deployDir).then(function(exist) {
        if (exist) return;
        console.log(chalk.red('Setting up Git deployment...'));
        return setup();
    }).then(function() {
        console.log(chalk.yellow('Clearing .deploy_git folder...'));
        return fs.emptyDir(deployDir);
    }).then(function() {
        console.log(chalk.yellow('Copying files from public folder...'));
        return fs.copyDir(publicDir, deployDir);
    }).then(function() {
        console.log(chalk.white('Push files from extend ') + chalk.yellow(deployDir));
    }).then(function() {
        return parseConfig(args);
    }).each(function(repo) {
        return push(repo);
    });
};

function commitMessage(args) {
    var message = args.m || args.msg || args.message || 'Site updated: {{ now(\'YYYY-MM-DD HH:mm:ss\') }}';
    return swig.compile(message)(swigHelpers);
}