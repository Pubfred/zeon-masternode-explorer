var express = require('express')
  , router = express.Router()
  , settings = require('../lib/settings')
  , locale = require('../lib/locale')
  , db = require('../lib/database')
  , lib = require('../lib/explorer')
  , qr = require('qr-image')
  , formatCurrency = require('format-currency')
  , formatNum = require('format-num')
  , BigNumber = require('bignumber.js')
  , BigInteger = require('big-integer')
;

function route_get_block(res, blockhash) {
  lib.get_block(blockhash, function (block) {
    if (block != 'There was an error. Check your console.') {
      if (blockhash == settings.genesis_block) {
        res.render('block', { active: 'block', block: block, confirmations: settings.confirmations, txs: 'GENESIS'});
      } else {
        db.get_txs(block, function(txs) {
          if (txs.length > 0) {
            res.render('block', { active: 'block', block: block, confirmations: settings.confirmations, txs: txs});
          } else {
            db.create_txs(block, function(){
              db.get_txs(block, function(ntxs) {
                if (ntxs.length > 0) {
                  res.render('block', { active: 'block', block: block, confirmations: settings.confirmations, txs: ntxs});
                } else {
                  route_get_index(res, 'Block not found: ' + blockhash);
                }
              });
            });
          }
        });
      }
    } else {
      route_get_index(res, 'Block not found: ' + blockhash);
    }
  });
}
/* GET functions */

function route_get_tx(res, txid) {
  if (txid == settings.genesis_tx) {
    route_get_block(res, settings.genesis_block);
  } else {
    db.get_tx(txid, function(tx) {
      if (tx) {
        lib.get_blockcount(function(blockcount) {
          res.render('tx', { active: 'tx', tx: tx, confirmations: settings.confirmations, blockcount: blockcount});
        });
      }
      else {
        lib.get_rawtransaction(txid, function(rtx) {
          if (rtx.txid) {
            lib.prepare_vin(rtx, function(vin) {
              lib.prepare_vout(rtx.vout, rtx.txid, vin, function(rvout, rvin) {
                lib.calculate_total(rvout, function(total){
                  if (!rtx.confirmations > 0) {
                    var utx = {
                      txid: rtx.txid,
                      vin: rvin,
                      vout: rvout,
                      total: total.toFixed(8),
                      timestamp: rtx.time,
                      blockhash: '-',
                      blockindex: -1,
                    };
                    res.render('tx', { active: 'tx', tx: utx, confirmations: settings.confirmations, blockcount:-1});
                  } else {
                    var utx = {
                      txid: rtx.txid,
                      vin: rvin,
                      vout: rvout,
                      total: total.toFixed(8),
                      timestamp: rtx.time,
                      blockhash: rtx.blockhash,
                      blockindex: rtx.blockheight,
                    };
                    lib.get_blockcount(function(blockcount) {
                      res.render('tx', { active: 'tx', tx: utx, confirmations: settings.confirmations, blockcount: blockcount});
                    });
                  }
                });
              });
            });
          } else {
            route_get_index(res, null);
          }
        });
      }
    });
  }
}

function route_get_index(res, error) {
  res.render('index', { active: 'home', error: error, warning: null});
}

function route_get_address(res, hash, count) {
  db.get_address(hash, function(address) {
    if (address) {
      var txs = [];
      var hashes = address.txs.reverse();
      if (address.txs.length < count) {
        count = address.txs.length;
      }
      lib.syncLoop(count, function (loop) {
        var i = loop.iteration();
        db.get_tx(hashes[i].addresses, function(tx) {
          if (tx) {
            txs.push(tx);
            loop.next();
          } else {
            loop.next();
          }
        });
      }, function(){

        // hack to support numbers longer than 15 digits.
        var balance = new BigInteger(address.balance);
        var viewBalance = balance.divide(100000000);
        var balanceRemain = new BigNumber(balance.toString().substr(
          viewBalance.toString().length));

        res.render('address', {
          active: 'address',
          address: address,
          balance: viewBalance.toString()+'.'+balanceRemain.toString(),
          txs: txs
        });
      });

    } else {
      route_get_index(res, hash + ' not found');
    }
  });
}

/* GET home page. */
router.get('/', function(req, res) {
  route_get_index(res, null);
});

router.get('/info', function(req, res) {
  res.render('info', { active: 'info', address: settings.address, hashes: settings.api });
});

router.get('/markets/:market', function(req, res) {
  var market = req.params['market'];
  if (settings.markets.enabled.indexOf(market) != -1) {
    db.get_market(market, function(data) {
      /*if (market === 'bittrex') {
        data = JSON.parse(data);
      }*/
      console.log(data);
      res.render('./markets/' + market, {
        active: 'markets',
        marketdata: {
          coin: settings.markets.coin,
          exchange: settings.markets.exchange,
          data: data,
        },
        market: market
      });
    });
  } else {
    route_get_index(res, null);
  }
});

router.get('/richlist', function(req, res) {
  if (settings.display.richlist == true ) {
    db.get_stats(settings.coin, function (stats) {
      db.get_richlist(settings.coin, function(richlist){
        //console.log(richlist);
        if (richlist) {
          db.get_distribution(richlist, stats, function(distribution) {
            //console.log(distribution);
            res.render('richlist', {
              active: 'richlist',
              balance: richlist.balance,
              received: richlist.received,
              stats: stats,
              coin_supply: new BigNumber(stats.supply - 400000 ).toFixed(8),
              dista: distribution.t_1_25,
              distb: distribution.t_26_50,
              distc: distribution.t_51_75,
              distd: distribution.t_76_100,
              diste: distribution.t_101plus,
              show_dist: settings.richlist.distribution,
              show_coin_supply: settings.richlist.coin_supply,
              show_received: settings.richlist.received,
              show_balance: settings.richlist.balance,
            });
          });
        } else {
          route_get_index(res, null);
        }
      });
    });
  } else {
    route_get_index(res, null);
  }
});

router.get('/masternodes', function(req, res) {
  res.render('masternodes', {active: 'masternodes'});
});

router.get('/coininfo', function(req, res) {
  if (settings.display.coininfo === false) {
    route_get_index(res, null);
    return;
  }

  db.get_stats(settings.coin, function(stats){
    db.get_cmc(settings.coinmarketcap.ticker, function(cmc) {
      lib.get_masternodecount(function(totalMnCount) {
        lib.get_masternodeonlinecount(function(activeMnCount) {
          db.get_latest_masternodestats(settings.symbol, function(mnStats) {
              

	    var blocksPerDay = (60*60*24)/60;
            
            var totalMnRewardsDay1 = 0.12 * blocksPerDay;
            var activeMasternodes1 = totalMnCount[0].count ;		  
            var mnRewardsPerDay1 = totalMnRewardsDay1 / activeMasternodes1;

            var totalMnRewardsDay2 = 0.36 * blocksPerDay;
            var activeMasternodes2 = totalMnCount[1].count ;
            var mnRewardsPerDay2 = totalMnRewardsDay2 / activeMasternodes2;

            var totalMnRewardsDay3 = 0.60 * blocksPerDay;
            var activeMasternodes3 = totalMnCount[2].count ;
            var mnRewardsPerDay3 = totalMnRewardsDay3 / activeMasternodes3;


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


           var priceBtc =  parseFloat(3.9e-7) ; 

           getJSON('https://api.coingecko.com/api/v3/simple/price?ids=zeon-2&vs_currencies=btc', function(data) {
                   var mydata = JSON.stringify(data) ;
                   var n = mydata.indexOf("btc");
                   console.log(n );
                   var n2 = mydata.indexOf("}}", 12);
                   console.log(n2 );
                   var res = mydata.substr(n + 5, n2 -n - 5   );
                   // mydata = (mydata[5] ) ;
                   priceBtc =  parseFloat(res) ;
            }, function(status) {
                   console.log('Something went wrong.');
           });




                      

            //var priceBtc = stats.last_price;
      
            //stats.last_price = priceBtc ;

            stats.last_price = priceBtc ; 
            var priceUsd = cmc.price_usd;
            var lastPriceUsd1 = formatCurrency( priceBtc   *  priceUsd , { maxFraction: 8 }) ;
            var marketCapUsd1 = formatCurrency(  (stats.supply - 400000 ) * lastPriceUsd1 , { maxFraction: 2 }) ;


            var calculatedBasedOnRealData = false;
            if (mnStats) {
              calculatedBasedOnRealData = true;
              mnRewardsPerDay2 = mnStats.reward_coins_24h;
            }

            var mnRewardsPerYear1 = mnRewardsPerDay1 * 365;
            var mnRoi1 = ((mnRewardsPerYear1 / 1000) * 100).toFixed(2);
           
            var mnRewardsPerYear2 = mnRewardsPerDay2 * 365;
            var mnRoi2 = ((mnRewardsPerYear2 / 1000) * 100).toFixed(2);
  		  
            var mnRewardsPerYear3 = mnRewardsPerDay3 * 365;
            var mnRoi3 = ((mnRewardsPerYear3 / 1000) * 100).toFixed(2);

            var coinsLocked = (totalMnCount[0].count * 1 + totalMnCount[1].count * 3 + totalMnCount[2].count * 5 ) * 1000;
            var coinsLockedPerc = (coinsLocked / (stats.supply - 400000 ))*100;
            
            var nodeWorthBtc1 = (1000 * priceBtc).toFixed(8);
            var nodeWorthBtc2 = (3000 * priceBtc).toFixed(8);	
            var nodeWorthBtc3 = (5000 * priceBtc).toFixed(8);

            var nodeWorthUsd1 = (cmc.price_usd) ? (1000 * cmc.price_usd).toFixed(2) : null;
            var nodeWorthUsd2 = (cmc.price_usd) ? (3000 * cmc.price_usd).toFixed(2) : null;
            var nodeWorthUsd3 = (cmc.price_usd) ? (5000 * cmc.price_usd).toFixed(2) : null;
  



            var dailyCoin1 = formatNum(mnRewardsPerDay1, { maxFraction: 4});
            var dailyBtc = formatNum(mnRewardsPerDay1 * priceBtc, { maxFraction: 8 });
            var dailyUsd = formatCurrency(  dailyBtc * priceUsd , { maxFraction: 2 });
            var weeklyCoin1 = formatNum(mnRewardsPerDay1 * 7, { maxFraction: 4});
            var weeklyBtc = formatNum(mnRewardsPerDay1 * priceBtc* 7, { maxFraction: 8 });
            var weeklyUsd = formatCurrency(weeklyBtc * priceUsd , { maxFraction: 2 });
            var monthlyCoin1 = formatNum(mnRewardsPerDay1 * (365/12), { maxFraction: 4});
            var monthlyBtc = formatNum( mnRewardsPerDay1 * priceBtc * (365/12), { maxFraction: 8 });
            var monthlyUsd = formatCurrency( monthlyBtc  * priceUsd , { maxFraction: 2 });
            var yearlyCoin1 = formatNum(mnRewardsPerDay1 * 365, { maxFraction: 4});
            var yearlyBtc = formatNum(mnRewardsPerDay1 * priceBtc * 365, { maxFraction: 8 });
            var yearlyUsd = formatCurrency( yearlyBtc * priceUsd  , { maxFraction: 2 });


            
            var dailyCoin2 = formatNum(mnRewardsPerDay2, { maxFraction: 4});
            var weeklyCoin2 = formatNum(mnRewardsPerDay2 * 7, { maxFraction: 4});
            var monthlyCoin2 = formatNum(mnRewardsPerDay2 * (365/12), { maxFraction: 4});
            var yearlyCoin2 = formatNum(mnRewardsPerDay2 * 365, { maxFraction: 4});
            var dailyBtc2 = formatNum(mnRewardsPerDay2 * priceBtc, { maxFraction: 8 });
            var weeklyBtc2 = formatNum(mnRewardsPerDay2 * priceBtc* 7, { maxFraction: 8 });
            var monthlyBtc2 = formatNum(mnRewardsPerDay2 * priceBtc * (365/12), { maxFraction: 8 });
            var yearlyBtc2 = formatNum(mnRewardsPerDay2 * priceBtc * 365, { maxFraction: 8 });		  
            var dailyUsd2 = formatCurrency(  dailyBtc2 * priceUsd , { maxFraction: 2 });
            var weeklyUsd2 = formatCurrency(weeklyBtc2 * priceUsd , { maxFraction: 2 });
            var monthlyUsd2 = formatCurrency( monthlyBtc2  * priceUsd , { maxFraction: 2 });
            var yearlyUsd2 = formatCurrency( yearlyBtc2 * priceUsd  , { maxFraction: 2 });		  


            var dailyCoin3 = formatNum(mnRewardsPerDay3, { maxFraction: 4});
            var weeklyCoin3 = formatNum(mnRewardsPerDay3 * 7, { maxFraction: 4});
            var monthlyCoin3 = formatNum(mnRewardsPerDay3 * (365/12), { maxFraction: 4});
            var yearlyCoin3 = formatNum(mnRewardsPerDay3 * 365, { maxFraction: 4});
            var dailyBtc3 = formatNum(mnRewardsPerDay3 * priceBtc, { maxFraction: 8 });
            var weeklyBtc3 = formatNum(mnRewardsPerDay3 * priceBtc* 7, { maxFraction: 8 });
            var monthlyBtc3 = formatNum(mnRewardsPerDay3 * priceBtc * (365/12), { maxFraction: 8 });
            var yearlyBtc3 = formatNum(mnRewardsPerDay3 * priceBtc * 365, { maxFraction: 8 });
            var dailyUsd3 = formatCurrency(  dailyBtc3 * priceUsd , { maxFraction: 2 });
            var weeklyUsd3 = formatCurrency(weeklyBtc3 * priceUsd , { maxFraction: 2 });
            var monthlyUsd3 = formatCurrency( monthlyBtc3  * priceUsd , { maxFraction: 2 });
            var yearlyUsd3 = formatCurrency( yearlyBtc3 * priceUsd  , { maxFraction: 2 });


            var data = {
              active: 'coininfo',
              coininfo: settings.coininfo,
              lastPriceBtc: formatCurrency(stats.last_price, { maxFraction: 8 }),
              lastPriceUsd: lastPriceUsd1,
              pricePercChange24h: cmc.percent_change_24h,
              marketCapUsd: marketCapUsd1,
              cmc: cmc,
              blockCount24h: -1,
              avgBlockTime: 60,
	      totalMasternodes1: totalMnCount[0].count	,
              totalMasternodes2: totalMnCount[1].count  , 	
	      totalMasternodes3: totalMnCount[2].count  ,	    
              totalMasternodes: totalMnCount[0].count + totalMnCount[1].count + totalMnCount[2].count  , 
              activeMasternodes1: activeMnCount[0].count ,
              activeMasternodes2: activeMnCount[1].count ,		    
              activeMasternodes3: activeMnCount[2].count ,		    
              activeMasternodes: activeMnCount[0].count +  activeMnCount[1].count + activeMnCount[2].count ,
              mnRoi: mnRoi1,
              supply: formatNum(stats.supply - 400000, { maxFraction: 0 }),
              coinsLocked: formatNum(coinsLocked, { maxFraction: 8 }),
              coinsLockedPerc: formatNum(coinsLockedPerc, { maxFraction: 2 }),
              mnRequiredCoins1: 1000 ,
              mnRequiredCoins2: 3000 ,		 
              mnRequiredCoins3: 5000 ,		    
              mnRequiredCoins: settings.coininfo.masternode_required,
              nodeWorthBtc1: formatCurrency(nodeWorthBtc1, { maxFraction: 8 }),
              nodeWorthBtc2: formatCurrency(nodeWorthBtc2, { maxFraction: 8 }),
              nodeWorthBtc3: formatCurrency(nodeWorthBtc3, { maxFraction: 8 }),
	      nodeWorthUsd1: nodeWorthUsd1 ? formatCurrency(nodeWorthUsd1, { maxFraction: 2 }) : null,
              nodeWorthUsd2: nodeWorthUsd2 ? formatCurrency(nodeWorthUsd2, { maxFraction: 2 }) : null,		    
              nodeWorthUsd3: nodeWorthUsd3 ? formatCurrency(nodeWorthUsd3, { maxFraction: 2 }) : null,
              dailyCoin1: dailyCoin1,
              dailyBtc: dailyBtc,
              dailyUsd: dailyUsd,
              weeklyCoin1: weeklyCoin1,
              weeklyBtc: weeklyBtc,
              weeklyUsd: weeklyUsd,
              monthlyCoin1: monthlyCoin1,
              monthlyBtc: monthlyBtc,
              monthlyUsd: monthlyUsd,
              yearlyCoin1: yearlyCoin1,
              yearlyBtc: yearlyBtc,
              yearlyUsd: yearlyUsd,
              dailyCoin2: dailyCoin2,
              weeklyCoin2: weeklyCoin2,		 
	      monthlyCoin2: monthlyCoin2,
              yearlyCoin2: yearlyCoin2,		 
	      dailyCoin3: dailyCoin3,
              weeklyCoin3: weeklyCoin3,
              monthlyCoin3: monthlyCoin3,
              yearlyCoin3: yearlyCoin3,	
	      dailyBtc2: dailyBtc2,
              weeklyBtc2: weeklyBtc2,    
              monthlyBtc2: monthlyBtc2,
              yearlyBtc2: yearlyBtc2,
              dailyBtc3: dailyBtc3,
              weeklyBtc3: weeklyBtc3,
              monthlyBtc3: monthlyBtc3,
              yearlyBtc3: yearlyBtc3,		  
              dailyUsd2: dailyUsd2,
              weeklyUsd2: weeklyUsd2,
              monthlyUsd2: monthlyUsd2,
              yearlyUsd2: yearlyUsd2,
              dailyUsd3: dailyUsd3,
              weeklyUsd3: weeklyUsd3,
              monthlyUsd3: monthlyUsd3,
              yearlyUsd3: yearlyUsd3,
              calculatedBasedOnRealData: calculatedBasedOnRealData
            };

            if (mnStats) {
              data.blockCount24h = mnStats.block_count_24h;
              data.avgBlockTime = mnStats.block_avg_time;
            }

            res.render('coininfo', data);
          });
        });
      });
    });
  });

});

router.get('/movement', function(req, res) {
  res.render('movement', {active: 'movement', flaga: settings.movement.low_flag, flagb: settings.movement.high_flag, min_amount:settings.movement.min_amount});
});

router.get('/network', function(req, res) {
  res.render('network', {active: 'network'});
});

router.get('/reward', function(req, res){
  //db.get_stats(settings.coin, function (stats) {
    console.log(stats);
    db.get_heavy(settings.coin, function (heavy) {
      //heavy = heavy;
      var votes = heavy.votes;
      votes.sort(function (a,b) {
        if (a.count < b.count) {
          return -1;
        } else if (a.count > b.count) {
          return 1;
        } else {
         return 0;
        }
      });

      res.render('reward', { active: 'reward', stats: stats, heavy: heavy, votes: heavy.votes });
    });
  //});
});

router.get('/tx/:txid', function(req, res) {
  route_get_tx(res, req.param('txid'));
});

router.get('/block/:hash', function(req, res) {
  route_get_block(res, req.param('hash'));
});

router.get('/address/:hash', function(req, res) {
  route_get_address(res, req.param('hash'), settings.txcount);
});

router.get('/address/:hash/:count', function(req, res) {
  route_get_address(res, req.param('hash'), req.param('count'));
});

router.post('/search', function(req, res) {
  var query = req.body.search;
  if (query.length === 64) {
    if (query === settings.genesis_tx) {
      res.redirect('/block/' + settings.genesis_block);
    } else {
      db.get_tx(query, function(tx) {
        if (tx) {
          res.redirect('/tx/' +tx.txid);
        } else {
          lib.get_block(query, function(block) {
            if (block && block !== 'There was an error. Check your console.') {
              res.redirect('/block/' + query);
            } else {
              route_get_index(res, locale.ex_search_error + query );
            }
          });
        }
      });
    }
  } else {
    db.get_address(query, function(address) {
      if (address) {
        res.redirect('/address/' + address.a_id);
      } else {
        lib.get_blockhash(query, function(hash) {
          if (hash && hash !== 'There was an error. Check your console.') {
            res.redirect('/block/' + hash);
          } else {
            route_get_index(res, locale.ex_search_error + query );
          }
        });
      }
    });
  }
});

router.get('/qr/:string', function(req, res) {
  if (req.param('string')) {
    var address = qr.image(req.param('string'), {
      type: 'png',
      size: 4,
      margin: 1,
      ec_level: 'M'
    });
    res.type('png');
    address.pipe(res);
  }
});

router.get('/ext/summary', function(req, res) {
  lib.get_difficulty(function(difficulty) {
    difficultyHybrid = ''
    if (difficulty['proof-of-work']) {
            if (settings.index.difficulty == 'Hybrid') {
              difficultyHybrid = 'POS: ' + difficulty['proof-of-stake'];
              difficulty = 'POW: ' + difficulty['proof-of-work'];
            } else if (settings.index.difficulty == 'POW') {
              difficulty = difficulty['proof-of-work'];
            } else {
        difficulty = difficulty['proof-of-stake'];
      }
    }
    lib.get_hashrate(function(hashrate) {
      lib.get_connectioncount(function(connections){
        lib.get_blockcount(function(blockcount) {
          lib.get_masternodecount(function(masternodecount){
            lib.get_masternodeonlinecount(function(masternodeonlinecount){
              db.get_cmc(settings.coinmarketcap.ticker, function(cmc){
                db.get_stats(settings.coin, function (stats) {
                  if (hashrate == 'There was an error. Check your console.') {
                    hashrate = 0;
                  }
                  res.send({ data: [{
                    difficulty: difficulty,
                    difficultyHybrid: difficultyHybrid,
                    masternodeCount: masternodecount,
                    masternodeOnlineCount: masternodeonlinecount,
                    supply: formatNum(stats.supply - 400000, { maxFraction: 2 }),
                    hashrate: hashrate,
                    lastPriceBtc: formatNum(stats.last_price, { maxFraction: 8 }),
                    lastPriceUsd: formatCurrency(cmc.price_usd, { maxFraction: 6 }),
                    marketCapUsd: formatCurrency(cmc.market_cap_usd, { maxFraction: 2 }),
                    marketVolumeUsd: formatCurrency(cmc.volume_24h_usd, { maxFraction: 2 }),
                    connections: connections,
                    blockcount: blockcount,
                    cmc: cmc,
                  }]});
                });
              });
            });
          });
        });
      });
    });
  });
});

router.get('/ext/masternodes', function(req, res) {
  lib.get_masternodelist(function(list) {
    var mnList = [];

    for (var key in list) {
      if (settings.baseType === 'pivx')
      {
        var mn = list[key];
        var mnItem = {
          address: mn.addr,
          status: mn.status,
          lastseen: mn.lastseen,
          lastpaid: mn.lastpaid,
          level: mn.level, 		          
        };
        mnList.push(mnItem);

        continue;
      }

      if (list.hasOwnProperty(key)) {
        var mnData = list[key].split(/(\s+)/).filter( function(e) { return e.trim().length > 0; } );
        var mnItem = {
          address: "",
          status: "",
          lastseen: "",
          lastpaid: null,
          level: "",	
        };

        // Address
        if (settings.masternodes.list_format.address === 0)
          mnItem.address = key;
        else if (settings.masternodes.list_format.address > -1)
          mnItem.address = mnData[settings.masternodes.list_format.address - 1];

        // Status
        if (settings.masternodes.list_format.status > -1)
          mnItem.status = mnData[settings.masternodes.list_format.status - 1];

        // last seen
        if (settings.masternodes.list_format.lastseen > -1)
          mnItem.lastseen = mnData[settings.masternodes.list_format.lastseen - 1];

        // last paid
        if (settings.masternodes.list_format.lastpaid > -1)
          mnItem.lastpaid = mnData[settings.masternodes.list_format.lastpaid - 1];
   
	if (settings.masternodes.list_format.level > -1)
          mnItem.level = mnData[settings.masternodes.list_format.level - 1];
      

/*        // IP
        if (settings.masternodes.list_format.ip === 0)
          mnItem.ip = key.trim().replace(':'+settings.masternodes.default_port, '');
        else if (settings.masternodes.list_format.ip > -1)
          mnItem.ip = mnData[settings.masternodes.list_format.ip - 1].trim().replace(':'+settings.masternodes.default_port, '');
*/
        mnList.push(mnItem);
      }
    }

    res.send({ data: mnList });
  });
});

router.get('/ext/coindetails', function(req, res) {
  lib.get_blockcount(function(blockcount) {
    lib.get_masternodecount(function(masternodecount){
      lib.get_masternodeonlinecount(function(masternodeonlinecount){
        db.get_cmc(settings.coinmarketcap.ticker, function(cmc){
          db.get_stats(settings.coin, function (stats) {
            db.get_latest_masternodestats(settings.symbol, function(mnStats) {
              var blocks_24h = (24*3600)/settings.coininfo.block_time_sec;

              var data = {
                coin_name: settings.coin,
                symbol: settings.symbol,
                logo: settings.logo,
                mobile_app_v: 1,
                supply: stats.supply,
                last_price_btc: stats.last_price,
                last_price_usd: cmc.price_usd,
                market_cap_usd: cmc.market_cap_usd,
                market_volume_24h_usd: cmc.volume_24h_usd,
                price_perc_change_1h: cmc.percent_change_1h,
                price_perc_change_24h: cmc.percent_change_24h,
                price_perc_change_7d: cmc.percent_change_7d,
                price_last_updated: cmc.last_updated,
                block_count_24h: (24*3600) / settings.coininfo.block_time_sec,
                block_time: settings.coininfo.block_time_sec,
                masternode_count_total: masternodecount,
                masternode_count_enabled: masternodeonlinecount,
                masternode_required_coins: settings.coininfo.masternode_required,
                masternode_coin_rewards_24h: (blocks_24h * settings.coininfo.block_reward_mn)/masternodeonlinecount,
                block_mn_reward: settings.coininfo.block_reward_mn,
                info_links: settings.coininfo.basic_info_links,
                calculations_bases_on_real_data: false
              };

              if (mnStats) {
                data.calculations_bases_on_real_data = true;
                data.masternode_coin_rewards_24h = mnStats.reward_coins_24h;
                data.block_count_24h = mnStats.block_count_24h;
                data.block_time = mnStats.block_avg_time;
              }

              res.send(data);
            });
          });
        });
      });
    });
  });
});

module.exports = router;
