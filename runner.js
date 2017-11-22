var testRun = require('./TimerTriggerJS/index.js');
require('dotenv').config();
context = {
    log:function(text){
        console.log(text);
    },
    done:function(){
        
    }
}

testRun(context, null);