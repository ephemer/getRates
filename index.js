/* ----------------------------------------------------------------------------

getRates.js - a simple command line app that fetches the latest exchange rates
from openexchangerates.org, converts them from USD-based rates to EUR/AUD, and
prints them to the command line in an easily readable format.

---------------------------------------------------------------------------- */

"use strict"; // Tell javascript not to accept any sloppy code from us

// ----------------------------------------------------------------------------
// We start off by 'requiring' external packages
// (so we don't have to write everything from scratch):

// An inbuilt node package that allows you to make http (web) requests
var http = require('http');

// An inbuilt node package that allows you to interact with the filesystem
var fs = require('fs');

// An inbuilt node package that deals with file paths OS-independently
var path = require('path');

// This just allows us to change the colours of the console.log output
var clc = require('cli-color');

// This function is to be called once we have some data (the object called obj)
var showResult = function(obj) {
	if( !(obj.rates && obj.rates.AUD && obj.rates.EUR) )
		throw new Error("Rates missing from data!");

	// console.log(obj) // Show the data that we got from our file / the web

	// Calculate EUR vs AUD rate
	// Original figures provided are EUR/USD, AUD/USD. We want:
	var rateEurAud = obj.rates.AUD / obj.rates.EUR; // AUD per EUR
	var rateAudEur = 1 / rateEurAud;                // EUR per AUD

	// Truncate the numbers to 4 decimal places
	rateEurAud = rateEurAud.toFixed(4);
	rateAudEur = rateAudEur.toFixed(4);

	// Use cli-color to set colours based on current rates:
	// If the AUD per EUR rate is above $1.50, blink green (buy AUD!)
	// Likewise if EUR per AUD is above €0.70 (buy EUR!)
	var colourEurAud = (rateEurAud > 1.5) ? clc.green.blink : clc.magenta;
	var colourAudEur = (rateAudEur > 0.7) ? clc.green.blink : clc.magenta;
	
	// When was the data we have last updated?
	var lastUpdated = new Date(obj.timestamp * 1000);

	// Show result
	console.log([
		clc.cyan.inverse(" Exchange rates from " + lastUpdated + " "),
		"  1 EUR buys " + colourEurAud("AUD $ " + rateEurAud),
		"  1 AUD buys " + colourAudEur("EUR € " + rateAudEur),
		"" // leave a blank line
	].join('\n'));
}

// ----------------------------------------------------------------------------
// First try to read from the cached data file. If this works, we don't even
// have to load the http request code (below) into memory.

// Store the path to our data file by joining the filename to the current dir
var currentRatesJSON = path.join(__dirname, "currentRates.json");

try { // 'try' to read and use data from our JSON file
	var fileContents = fs.readFileSync( currentRatesJSON, { encoding: 'utf8' } );
	var obj = JSON.parse(fileContents);

	// Do something with our data
	var dataFrom = obj.timestamp * 1000; // convert seconds to miliseconds
	var anHourAgo = Date.now() - 1000 * 60 * 60; // ms since 01/01/1970 minus 1hr

	if( dataFrom > anHourAgo ) { // data is still fresh
		// console.log("Using cached data:");
		return showResult(obj); // 'return' ends the program here
	}
} catch (err) { // if there was an error, report it
	if(err.errno === 34) console.log("Cached data file missing...");
	else console.log(err);
}

// ----------------------------------------------------------------------------
// The program is still running (it didn't reach the 'return' statement above)
// Looks like we have to make the API request via http

// Call this once the http.request (below) connects
var httpCallback = function(response) {
	console.log("Fetching new currency exchange data:");
	var httpResult = '';

	// Whenever a chunk of http data is received:
	response.on('data', function (chunk) {
		// append it to `httpResult`
		httpResult += chunk;
	});

	// Once the whole response has been received:
	response.on('end', function () {
		// (otherwise) Save result in .json data file
		fs.writeFile( currentRatesJSON, httpResult, function(err) {
			if (err) console.error(err); // Report any errors writing to file
		});

		// Turn the JSON data we (hopefully) received into a javascript object
		var obj = JSON.parse(httpResult);
		if (obj.error) return console.error(obj); // complain if there's an error
		showResult(obj); // otherwise use the data we received.
	});
}

// Set up the openexchangerates.org API key (from your account there)
try { // See if we can read the key from the file
	var apiKeyFile = path.join(__dirname, "api_key.txt");
	var apiKey = fs.readFileSync( apiKeyFile, { encoding: 'utf8' } ).trim();
	if( !apiKey || apiKey.length !== 32 )
		throw new Error();
} catch (e) {
	return console.error([
		"Error: please provide your openexchangerates.org account's API key in ",
		"  " + clc.cyan(apiKeyFile),
		""
	].join('\n'));
}

// Set up the url we're going to request data from
var httpOptions = {
	host: 'openexchangerates.org',
	path: '/api/latest.json?app_id=' + apiKey
};

// Make the request
http.request(httpOptions, httpCallback).end();