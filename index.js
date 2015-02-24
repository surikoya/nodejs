var cheerio = require('cheerio')
var http = require("http");
var _ = require('lodash-node');
var nano = require('nano')('http://<your_couchdb_url>');
var db_name = "<db name>";
var doc_id = '<your doc id>';


var aqiRangeDefinition = [
 { 'name':'Good', 'color': 'green', 'min': 0, 'max': 50, 'meaning': 'Air quality is considered satisfactory, and air pollution poses little or no risk', 'hexcolor':'#00e400'},
 { 'name':'Moderate', 'color': 'yellow', 'min': 51, 'max': 100, 'meaning': 'Air quality is acceptable; however, for some pollutants there may be a moderate health concern for a very small number of people who are unusually sensitive to air pollution.', 'hexcolor': '#ffff00'},
 { 'name':'Unhealthy for Sensitive Groups', 'color': 'orange', 'min': 101, 'max': 150, 'meaning': 'Members of sensitive groups may experience health effects. The general public is not likely to be affected. ', 'hexcolor': '#ff7e00'},
 { 'name':'Unhealthy', 'color': 'red', 'min': 151, 'max': 200, 'meaning': 'Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.', 'hexcolor':'#ff0000'},
 { 'name':'Very Unhealthy', 'color': 'purple', 'min': 201, 'max': 300, 'meaning': 'Health warnings of emergency conditions. The entire population is more likely to be affected. ', 'hexcolor': '#99004c'},
 { 'name':'Hazardous', 'color': 'maroon', 'min': 301, 'max': 500, 'meaning': 'Health alert: everyone may experience more serious health effects', 'hexcolor': '#7e0023'}
];
var LOCATION_PREFIX_MAPPING = {
	'ND': {'city': 'New Delhi', 'id' : 53 },
	'HD': {'city': 'Hyderabad', 'id' : 69 },
	'CH': {'city': 'Chennai', 'id' : 57 },
	'KL': {'city': 'Kolkata', 'id' : 61 },
	'MB': {'city': 'Mumbai', 'id' : 65 }
};
var options = {hostname: 'clonewdelhi.com',
  path: '/includes/aqm.php',
  method: 'GET'
};

function gotHTML( html) {
  var $ = cheerio.load(html, {
    normalizeWhitespace: true
})
  var readings = [];	
  // get all img tags and loop over them
  var imageURLs = []
  var elems = $('p[id$="_val"]')
  _.each(elems, function(e) {
	var loc_ind =  $(e).attr('id');
	if (typeof loc_ind !== 'undefined' && (loc_ind.length >= 6 && loc_ind.substring(2,6) === '_val' )) {
		var loc_prefix = loc_ind.substring(0,2);
		var aqi = +$('#' + LOCATION_PREFIX_MAPPING[loc_prefix].id).text();
		var aqiMapping = {};
		aqiRangeDefinition.filter(function (range) { if (range.min <= aqi && range.max >= aqi)aqiMapping = range;}) 
		console.log('At Location:%s, AQI:%s',LOCATION_PREFIX_MAPPING[loc_prefix].city, aqi);	
		console.log(aqiMapping);
		readings.push({'location':LOCATION_PREFIX_MAPPING[loc_prefix].city, 'aqiValue': aqi, 'aqiRange':aqiMapping})				
	}
  });
	var db = nano.use(db_name); 
	console.log('Saving the data to server');
	returnedResponse = {
		'healthMapResponse': readings,
		'doctype': 'aaqdata'	
	};
   
    //Insert into database
    db.insert(returnedResponse, doc_id,
      function (error,http_body) {
	  
        if(error) {
			if(error.error === 'no_db_file') {
				// No database fail
				console.log('No database exists');
			}else if(error.error=== 'conflict') {
				return db.get(doc_id, function (err, doc){
					returnedResponse['_rev'] = doc['_rev'];
					db.insert(returnedResponse, doc_id, function(error, response){
						if (!error) {
							console.log('Record updated');
						} else {
							console.error('Update failed');
						}
					});	
				});
			} else { 
				console.log("Some other error occurred");
				console.log(error); 
			}
        } else {
			console.log(http_body);
		}
    });		   
}

var req = http.request (options, function(res) {
	var dataResponse = ""; 	
	console.log('STATUS: ' + res.statusCode);
	console.log('HEADERS: ' + JSON.stringify(res.headers));
	res.setEncoding('utf8');

	res.on('data', function (chunk) {
		dataResponse += chunk;
	});
	res.on('end', function (chunk) {
		gotHTML(dataResponse);
	});

	res.on('error', function (chunk) {
		console.log('Got error: ' + chunk);
	});

});
req.end();