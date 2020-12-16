const MediaServices = require("@azure/arm-mediaservices");
const msRestAzure = require("@azure/ms-rest-azure-js");
const msRest = require("@azure/ms-rest-js");
const msRestNodeAuth = require("@azure/ms-rest-nodeauth");

const mySQL = require('mysql');
const knex = require('knex')({
    client: "mysql",
    connection: {
        host: 'localhost',
        user: 'your username',
        password: 'your password',
        database: "ams_db"
    }
});

const resourceGroup = "Your resource group name";
const accountName = "Your account name";
const aadClientId = "Your info here";
const aadSecret = "Your info here";
const aadDomain = "Your info here";
const subscriptionId = "Your info here";


// let azureMediaServicesClient;


// msRestNodeAuth.loginWithServicePrincipalSecret()
module.exports = class Administrator{
    constructor(){
        this.azureMediaServicesClient;
        
        // This method of connection can be used to connect through a browser.
        // msRestNodeAuth.interactiveLogin().then( async (creds) => {
        //     this.azureMediaServicesClient = new MediaServices.AzureMediaServices(creds, subscriptionId);
        //     // let assetList = await this.azureMediaServicesClient.assets.list(resourceGroup, accountName, {top: 5});
        //     // console.log(assetList);
        //     console.log("You are now connected to your AMS account");
        
        // }).catch((err) => {
        //     console.error(err);
        // });

        // This method of connection is faster, and better for testing.
        msRestNodeAuth.loginWithServicePrincipalSecret(aadClientId, aadSecret, aadDomain).then( creds => {
            this.azureMediaServicesClient = new MediaServices.AzureMediaServices(creds, subscriptionId);
            console.log("You are now connected to AMS");
        }).catch((err) => {
            console.error(err);
        })

        // knex.schema.createTable('assets', table => {
        //     table.increments('id');
        //     table.string('asset_id');
        //     table.string('streaming_locator');
        //     console.log("Table created!");
        // }).catch(err => console.log("There's been an error: " + err));
        
    }

    async getStreamingLocators(){
        let locatorList = await this.azureMediaServicesClient.streamingLocators.list(resourceGroup, accountName);
        console.log(locatorList);
        return locatorList;
    }
    
    async getExpiredLocators(){
        //
        let locatorList = await this.azureMediaServicesClient.streamingLocators.list(resourceGroup, accountName);
        console.log(locatorList);
        let expiredList = [];
        locatorList.forEach(locator => {
            console.log(locator.endTime);
            if(locator.endTime < Date.now()){
                console.log("Expired");
                expiredList.push(locator);
            }else{
                console.log("Not expired");
            }
        });

        return expiredList;
    }

    async transferStreamingLocators(){
        // this function creates DB copies of the streaming locators
        let locatorList = await this.azureMediaServicesClient.streamingLocators.list(resourceGroup, accountName);
        console.log(locatorList);
        locatorList.forEach( async locator => {
            console.log(locator.streamingPolicyName);
            
            let check = await knex.where("streaming_locator", locator.streamingLocatorId).from('assets')
            if(check != ""){
                console.log("exists");
                console.log("Value of check: " + check);
            }else{
                console.log("doesn't exist");
                console.log("Value of check: " + check);
                knex('assets').insert({
                    asset_id: locator.assetName,
                    streaming_locator: locator.streamingLocatorId
                }).catch(err => {
                    console.log('Insert error: ' + err);
                })
            }
        });
        let all_assets = await knex.select().from('assets');
        console.log(all_assets);
        // iterate through list, checking to see if there's a matching record
        return all_assets;
    }

    async refreshExpired(){
        // this function refreshes the expired streaming locators
        let expiredList = await this.getExpiredLocators();
        expiredList.forEach(async locator => {
            await this.azureMediaServicesClient.streamingLocators.deleteMethod(resourceGroup, accountName, locator.name);
            let newLoc = await this.azureMediaServicesClient.streamingLocators.create(resourceGroup, accountName, locator.name, {
                streamingPolicyName: "Predefined_ClearStreamingOnly",
                assetName: locator.assetName
            })
            console.log(newLoc);
            console.log("locator's streaming locatorID: " + locator.streamingLocatorId);
            let test = await knex("assets").where("streaming_locator", locator.streamingLocatorId)
            .update({streaming_locator: newLoc.streamingLocatorId})

            console.log(test);
        });
    }
}