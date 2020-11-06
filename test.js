

     fetchRestaurants(callback) {
           fetch("https://api.coingecko.com/api/v3/simple/price?ids=zeon-2&vs_currencies=btc")
           .then(response => response.json())
           .then(json => callback(null, json.restaurants))
           .catch(error => callback(error, null))
         }

     fetchRestaurants((error, restaurants) => {
          if (error) 
            console.log(error)
          else 
             console.log(restaurants[0])
      });





//            var coingecko = fetch("https://api.coingecko.com/api/v3/simple/price?ids=zeon-2&vs_currencies=btc");
//            console.log(coingecko);


