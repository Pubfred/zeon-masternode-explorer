//var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

var XMLHttpRequest = require('xhr2');
// var xhr = new XMLHttpRequest();



var getJSON = function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.onload = function() {
      var status = xhr.status;
      if (status === 200) {
        callback(null, xhr.response);
      } else {
        callback(status, xhr.response);
      }
    };
    xhr.send();
};


getJSON("https://api.coingecko.com/api/v3/simple/price?ids=zeon-2&vs_currencies=usd",
function(err, data) {
  if (err !== null) {
    console.log('Something went wrong: ' + err);
  } else {

    var  obj = JSON.parse(data);  	  
    console.log('Your query count12: ' + obj);
  }
});


  console.log('Your query count: ');




