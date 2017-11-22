import * as ftpClient from 'promise-ftp';
import * as azure from 'azure-storage';
import { ErrorOrResult } from 'azure-storage';
import * as fs from 'fs';
import * as del from 'del';

require('dotenv').config();

class blobs{
    /**
     *
     */

    private blobService: azure.BlobService;
    private container:string = "radar";
    private context:any;
    
    constructor(context:any) {
        this.blobService = azure.createBlobService(); 
        this.context = context;
    }

    public uploadFile(localFile:string, remoteFile:string):Promise<boolean>{
        return new Promise((good, bad)=>{
            this.blobService.createBlockBlobFromLocalFile(this.container, remoteFile,
                 localFile, (error, result, response)=>{
                if(!error){
                    this.context.log(`Uploaded: ${remoteFile}`);
                    good(true);
                  // file uploaded
                }else{
                    this.context.log("Error uploading");
                    bad(error);
                    
                }
              });
        });
    }

    public checkFile(filePath:string) : Promise<boolean>{
        
        return new Promise((good, bad)=>{
            this.blobService.doesBlobExist(this.container, filePath, (error, result)=>{
                this.context.log(`Check blob for ${filePath}`)
                if(error){
                    this.context.log(`Blob error: ${error}`);
                    bad(error);
                }else{
                    if(result){
                        good(result.exists);
                    }else{
                        this.context.log(`No result was found!`);
                        good(false);
                    }                    
                }
            });
        });
        
    }
}

class getter {

    private client: any;
    private blob:blobs;
    private context:any;
    constructor(context:any) {
        this.client = new ftpClient();
        this.blob = new blobs(context);
        this.context=context;
    }

    async clean(){
        await del(['D:/local/Temp/output/*']);
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
                    this.context.log(`Checking blob: ${fn}`);
                    var exists = await this.blob.checkFile(fn);
                    this.context.log(`${exists} - ${fn}`);

                    if(!exists){
                        var dl = await this.client.get(`/anon/gen/radar/${listItem.name}`);
                        await this.saveStream(listItem.name, dl);
                        await this.blob.uploadFile(`D:/local/Temp/output/${listItem.name}`, fn);
                    }
                }                
            }
        }
        this.clean();
        return listResult;
    }

    private saveStream(fn:string, stream:any){
        this.context.log(`Writing local: ${fn}`);
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

module.exports = async function (context:any, myTimer:any) {
    
    context.log('Running radar job');   
    
    try{
        fs.mkdirSync('D:/local/Temp/output');
    }catch(e){}
    
    try{
        var g = new getter(context);
        await g.get();
    }catch(e){
        context.log("Problem " + e);
    }
    
    //context.done();
};