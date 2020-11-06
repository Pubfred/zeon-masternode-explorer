
var XMLHttpRequest = require('xhr2');


var getJSON = function(url, successHandler, errorHandler) {
	var xhr = typeof XMLHttpRequest != 'undefined'
		? new XMLHttpRequest()
		: new ActiveXObject('Microsoft.XMLHTTP');
	xhr.open('get', url, true);
	xhr.responseType = 'json';
	xhr.onreadystatechange = function() {
		var status;
		var data;
		// https://xhr.spec.whatwg.org/#dom-xmlhttprequest-readystate
		if (xhr.readyState == 4) { // `DONE`
			status = xhr.status;
			if (status == 200) {
				successHandler && successHandler(xhr.response);
			} else {
				errorHandler && errorHandler(status);
			}
		}
	};
	xhr.send();
};

 var priceBtc ;



getJSON('https://api.coingecko.com/api/v3/simple/price?ids=zeon-2&vs_currencies=btc', function(data) {
      var mydata = JSON.stringify(data) ;
      var n = mydata.indexOf("btc");
      console.log(n );
      var n2 = mydata.indexOf("}}", 12);
      console.log(n2 );



      var res = mydata.substr(n + 5, n2 -n - 5   );	
       // mydata = (mydata[5] ) ; 	
      priceBtc =  parseFloat(res) ;
      console.log('Your public IP address is: ' + priceBtc ) ;
	
   }, function(status) {
      console.log('Something went wrong.');
});


  console.log('Your public IP address is: ' + priceBtc ) ;



