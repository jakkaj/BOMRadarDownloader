import * as ftpClient from 'promise-ftp';
import * as azure from 'azure-storage';
import { ErrorOrResult } from 'azure-storage';
import * as fs from 'fs';

require('dotenv').config();

class blobs{
    /**
     *
     */

    private blobService: azure.BlobService;
    private container:string = "radar";
    constructor() {
        this.blobService = azure.createBlobService(); 
    }

    public uploadFile(localFile:string, remoteFile:string):Promise<boolean>{
        return new Promise((good, bad)=>{
            this.blobService.createBlockBlobFromLocalFile(this.container, remoteFile,
                 localFile, function(error, result, response){
                if(!error){
                    console.log(`Uploaded: ${remoteFile}`);
                    good(true);
                  // file uploaded
                }else{
                    console.log("Error uploading");
                    bad(error);
                    
                }
              });
        });
    }

    public checkFile(filePath:string) : Promise<boolean>{
        
        return new Promise((good, bad)=>{
            this.blobService.doesBlobExist(this.container, filePath, (error, result)=>{
                if(error){
                    bad(error);
                }else{
                    good(result.exists);
                }
            });
        });
        
    }
}

class getter {

    private client: any;
    private blob:blobs;

    constructor() {
        this.client = new ftpClient();
        this.blob = new blobs();
    }

    async get(): Promise<string[]> {

        var connectMsg = await this.client.connect({
            host: "ftp.bom.gov.au",
            port: 21
        });

        var resultString: string[] = [];

        var listResult = await this.client.list('/anon/gen/radar');

        for (var i in listResult) {
            var listItem = listResult[i];

            if (listItem.name.match(/IDR713/gi) &&
                listItem.name.match(/\.png/gi)
            ) {
                
                listResult.push(listItem.name);

                var fn = this.getName(listItem.name);
                if(fn != ""){
                    var exists = await this.blob.checkFile(fn);
                    console.log(`${exists} - ${fn}`);

                    if(!exists){
                        var dl = await this.client.get(`/anon/gen/radar/${listItem.name}`);
                        await this.saveStream(listItem.name, dl);
                        await this.blob.uploadFile(`temp/${listItem.name}`, fn);
                    }
                }
                //console.log(listItem);
            }
        }

        return listResult;
    }

    private saveStream(fn:string, stream:any){
        return new Promise(function (resolve, reject) {
            stream.once('close', resolve);
            stream.once('error', reject);
            stream.pipe(fs.createWriteStream(`temp/${fn}`));
          });
    }

    private getName(fn:string):string{
        var rgx = /(\d{4})(\d{2})(\d{2})(\d{4})/;
        
        var result = fn.match(rgx);

        if(!result){
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