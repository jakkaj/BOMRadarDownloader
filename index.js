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
require('dotenv').config();
class blobs {
    constructor() {
        this.container = "radar";
        this.blobService = azure.createBlobService();
    }
    uploadFile(localFile, remoteFile) {
        return new Promise((good, bad) => {
            this.blobService.createBlockBlobFromLocalFile(this.container, remoteFile, localFile, function (error, result, response) {
                if (!error) {
                    console.log(`Uploaded: ${remoteFile}`);
                    good(true);
                    // file uploaded
                }
                else {
                    console.log("Error uploading");
                    bad(error);
                }
            });
        });
    }
    checkFile(filePath) {
        return new Promise((good, bad) => {
            this.blobService.doesBlobExist(this.container, filePath, (error, result) => {
                if (error) {
                    bad(error);
                }
                else {
                    good(result.exists);
                }
            });
        });
    }
}
class getter {
    constructor() {
        this.client = new ftpClient();
        this.blob = new blobs();
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
                        console.log(`${exists} - ${fn}`);
                        if (!exists) {
                            var dl = yield this.client.get(`/anon/gen/radar/${listItem.name}`);
                            yield this.saveStream(listItem.name, dl);
                            yield this.blob.uploadFile(`temp/${listItem.name}`, fn);
                        }
                    }
                    //console.log(listItem);
                }
            }
            return listResult;
        });
    }
    saveStream(fn, stream) {
        return new Promise(function (resolve, reject) {
            stream.once('close', resolve);
            stream.once('error', reject);
            stream.pipe(fs.createWriteStream(`temp/${fn}`));
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
var g = new getter();
g.get();
