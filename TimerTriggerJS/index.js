"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ftpClient = require("promise-ftp");
const azure = require("azure-storage");
const fs = require("fs");
const path = require("path");
const del = require("del");
class blobs {
    constructor(context) {
        this.container = "radar";
        this.blobService = azure.createBlobService();
        this.context = context;
    }
    uploadFile(localFile, remoteFile) {
        return new Promise((good, bad) => {
            this.blobService.createBlockBlobFromLocalFile(this.container, remoteFile, localFile, (error, result, response) => {
                if (!error) {
                    this.context.log(`Uploaded: ${remoteFile}`);
                    good(true);
                    // file uploaded
                }
                else {
                    this.context.log("Error uploading");
                    bad(error);
                }
            });
        });
    }
    checkFile(filePath) {
        return new Promise((good, bad) => {
            this.blobService.doesBlobExist(this.container, filePath, (error, result) => {
                if (error) {
                    this.context.log(`Blob error: ${error}`);
                    bad(error);
                }
                else {
                    if (result) {
                        good(result.exists);
                    }
                    else {
                        this.context.log(`No result was found!`);
                        good(false);
                    }
                }
            });
        });
    }
}
class getter {
    constructor(context, tempPath) {
        this.client = new ftpClient();
        this.blob = new blobs(context);
        this.context = context;
        this.tempPath = tempPath;
    }
    clean() {
        return __awaiter(this, void 0, void 0, function* () {
            yield del([`${this.tempPath}/*`], { force: true });
        });
    }
    get() {
        return __awaiter(this, void 0, void 0, function* () {
            var connectMsg = yield this.client.connect({
                host: "ftp.bom.gov.au",
                port: 21
            });
            var resultString = [];
            var listResult = yield this.client.list('/anon/gen/radar');
            for (var i in listResult) {
                var listItem = listResult[i];
                if (listItem.name.match(/IDR713/gi) &&
                    listItem.name.match(/\.png/gi)) {
                    listResult.push(listItem.name);
                    var fn = this.getName(listItem.name);
                    if (fn != "") {
                        var exists = yield this.blob.checkFile(fn);
                        this.context.log(`${exists} - ${fn}`);
                        if (!exists) {
                            var dl = yield this.client.get(`/anon/gen/radar/${listItem.name}`);
                            var localSave = path.join(this.tempPath, listItem.name);
                            yield this.saveStream(localSave, dl);
                            yield this.blob.uploadFile(localSave, fn);
                        }
                    }
                }
            }
            this.clean();
            return listResult;
        });
    }
    saveStream(fn, stream) {
        this.context.log(`Writing local: ${fn}`);
        return new Promise(function (resolve, reject) {
            stream.once('close', resolve);
            stream.once('error', reject);
            stream.pipe(fs.createWriteStream(fn));
        });
    }
    getName(fn) {
        var rgx = /(\d{4})(\d{2})(\d{2})(\d{4})/;
        var result = fn.match(rgx);
        if (!result) {
            return "";
        }
        var year = result[1];
        var month = result[2];
        var day = result[3];
        var hour = result[4];
        return `${year}/${month}/${day}/${hour}.png`;
    }
}
module.exports = function (context, myTimer) {
    return __awaiter(this, void 0, void 0, function* () {
        context.log('Running radar job');
        var tempPath = process.env.temp;
        tempPath = path.join(tempPath, "output");
        try {
            fs.mkdirSync(tempPath);
        }
        catch (e) {
            context.log(`Could not create ${tempPath} ${e}`);
        }
        try {
            var g = new getter(context, tempPath);
            yield g.get();
        }
        catch (e) {
            context.log("Problem " + e);
        }
        //context.done();
    });
};
