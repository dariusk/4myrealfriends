var request = require('request');
var _ = require('underscore');
_.mixin( require('underscore.deferred') );
var Twit = require('twit');
var T = new Twit(require('./config.js'));
var wordfilter = require('wordfilter');
var key = require('./permissions.js').API_KEY;
var pos = require('pos');

Array.prototype.pick = function() {
  return this[Math.floor(Math.random()*this.length)];
};

Array.prototype.pickRemove = function() {
  var index = Math.floor(Math.random()*this.length);
  return this.splice(index,1)[0];
};

function getPos(word) {
  var words = new pos.Lexer().lex(word);
  var taggedWords = new pos.Tagger().tag(words);
  var taggedWord = taggedWords[0];
  var tag = taggedWord[1];
  return tag;
}
console.log(getPos('red'));

function getBigrams(word) {
  var dfd = new _.Deferred();

  var urlPre = 'http://api.wordnik.com:80/v4/word.json/';
  var urlPost = '/phrases?limit=1000&wlmi=0&useCanonical=false&api_key=';
  var url = urlPre + word + urlPost + key;

  request(url, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var data = JSON.parse(body);
      dfd.resolve(data);
    }
    else {
      dfd.reject();
    }
  });

  return dfd.promise();
}

function generate() {
  var dfd = new _.Deferred();
  /*
  var url = 'someUrl';
  request(url, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var result = '';
      var $ = cheerio.load(body);
      // parse stuff and resolve
      dfd.resolve(result);
    }
    else {
      dfd.reject();
    }
  });
  */
  // A B for my C friends, C B for my A friends
  var word = ['enemies','friends','heroes','lover','people','folks','boss','dogs','cats'].pick(), A = 'real', B = 'pain', C = '';
  getBigrams(word).done(function(data) {
    // filter so we only have results where word is the 2nd gram and gram1 is adj
    data = _.filter(data, function(el) {
      return el.gram2 === word && getPos(el.gram1).indexOf('JJ') > -1 && el.gram1 !== 'other' && el.gram1 !== 'own' && el.gram1 !== 'many';
    });
    console.log(data.length);
    C = data.pick().gram1;
    console.log(C);
    getBigrams(C).done(function(data) {
      // filter so we only have results where C is the 1st gram and gram2 is noun,
      // and gram2 isn't the original word again
      data = _.filter(data, function(el) {
        return el.gram1 === C && getPos(el.gram2).indexOf('NN') > -1 && el.gram2 !== word;
      });
      if (data.length > 0) {
        B = data.pick().gram2;
      }
      console.log(B);
      getBigrams(B).done(function(data) {
        // filter so we only have results where B is the 2nd gram and gram1 is adj,
        // and gram1 isn't C again
        data = _.filter(data, function(el) {
          return el.gram2 === B && getPos(el.gram1).indexOf('JJ') > -1 && el.gram1 !== C && el.gram1 !== 'other' && el.gram1 !== 'own' && el.gram1 !== 'many';
        });
        if (data.length > 0) {
          A = data.pick().gram1;
        }
        var res = A + ' ' + B + ' for my ' + C + ' ' + word + ', ' + C + ' ' + B + ' for my ' + A + ' ' + word + '.';
        dfd.resolve(res);
      });
    });
  });

  return dfd.promise();
}

function tweet() {
  generate().then(function(myTweet) {
    if (!wordfilter.blacklisted(myTweet)) {
      console.log(myTweet);
      T.post('statuses/update', { status: myTweet }, function(err, reply) {
        if (err) {
          console.log('error:', err);
        }
        else {
          console.log('reply:', reply);
        }
      });
    }
  });
}

// Tweet every 2 hours
setInterval(function () {
  try {
    tweet();
  }
  catch (e) {
    console.log(e);
  }
}, 1000 * 60 * 60 * 2);

// Tweet once on initialization
tweet();
