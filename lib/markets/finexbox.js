var request = require('request');

var base_url = 'https://xapi.finexbox.com/v1/';

function get_summary(coin, exchange, cb) {
  var req_url = base_url + 'ticker?market=' + coin + '_' + exchange;
  request({uri: req_url, json: true}, function (error, response, body) {
    if (error) {
      return cb(error, null);
    } else {
      if (body.message) {
        return cb(body.message, null)
      } else {
	console.log(body.message);      
        body.result['last'] = body.result['price'];
        return cb (null, body.result);
      }
    }
  });
}

function get_trades(coin, exchange, cb) {
  var req_url = base_url + 'history?market=' + coin + '_' + exchange + '&count=50';
  request({uri: req_url, json: true}, function (error, response, body) {
    if (body.success == "true") {
      return cb (null, body.result);
    } else {
      return cb(body.message, null);
    }
  });
}

function get_orders(coin, exchange, cb) {
  var req_url = base_url + 'orders?market='  + coin + '_' + exchange +  '&count=50';
  request({uri: req_url, json: true}, function (error, response, body) {
    if (body.success == "true") {
      var orders = body.result;
      var buys = [];
      var sells = [];
      if (orders['buy'].length > 0){
          for (var i = 0; i < orders['buy'].length; i++) {
            var order = {
              amount: parseFloat(orders.buy[i].amount).toFixed(8),
              price: parseFloat(orders.buy[i].price).toFixed(8),
              //  total: parseFloat(orders.buy[i].Total).toFixed(8)
              // Necessary because API will return 0.00 for small volume transactions
              total: (parseFloat(orders.buy[i].amount).toFixed(8) * parseFloat(orders.buy[i].price)).toFixed(8)
            }
            buys.push(order);
          }
      }
      if (orders['sell'].length > 0) {
        for (var x = 0; x < orders['sell'].length; x++) {
            var order = {
                amount: parseFloat(orders.sell[x].amount).toFixed(8),
                price: parseFloat(orders.sell[x].price).toFixed(8),
                //    total: parseFloat(orders.sell[x].Total).toFixed(8)
                // Necessary because API will return 0.00 for small volume transactions
                total: (parseFloat(orders.sell[x].amount).toFixed(8) * parseFloat(orders.sell[x].price)).toFixed(8)
            }
            sells.push(order);
        }
      }
      return cb(null, buys, sells);
    } else {
      return cb(body.message, [], []);
    }
  });
}

module.exports = {
  get_data: function(coin, exchange, cb) {
    var error = null;
    get_orders(coin, exchange, function(err, buys, sells) {
      if (err) { error = err; }
      get_trades(coin, exchange, function(err, trades) {
        if (err) { error = err; }
        get_summary(coin, exchange, function(err, stats) {
          if (err) { error = err; }
          return cb(error, {buys: buys, sells: sells,  chartdata: [], trades: trades, stats: stats});
        });
      });
    });
  }
};
