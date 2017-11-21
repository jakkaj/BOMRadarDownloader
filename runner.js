var testRun = require('./index.js');

context = {
    log:function(text){
        console.log(text);
    },
    done:function(){
        
    }
}

testRun(context, null);