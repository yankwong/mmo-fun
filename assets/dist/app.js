$(function() {
  // animation that affect the entire programs goes here
  
});

$(document).on('gameStarted', function(e, playerID) {
  // animation that affect only the game part of the programs goes here
}); 
// utility object to interact Deck of Card API
var YTK = YTK || {};

YTK.cards = (function() {
  var 
  makeQuery = function(apiURL, paramObj) {
    var url = apiURL + '?' + $.param(paramObj);
    return url;
  },
  callAPI = function(url, callback) {
    $.ajax({
      url: url,
    })
    .done(function(results) {
      console.log('card API: ', results);
      callback(results);
    })
    .fail(function() {
      console.log('%ccardAPI ajax failed', 'color: red; font-weight: bold;');
    })
  },
  getDeckStat = function(deckID, callback) {
    var url = 'https://deckofcardsapi.com/api/deck/' + deckID + '/';
    callAPI(url, callback);
  },
  initDeck = function(deckTotal, callback) {
    var url = 'https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=' + deckTotal;
    callAPI(url, callback);
  },
  getImg = function(cardID) {
    if (cardID == 'AD') {
      return 'assets/images/' + cardID + '.png';  
    }
    else {
      return 'http://deckofcardsapi.com/static/img/' + cardID + '.png';  
    }
  },
  drawCards = function(deckID, total, callback) {
    var url = 'https://deckofcardsapi.com/api/deck/' + deckID + '/draw/?count=' + total;
    callAPI(url, callback);
  };
  return {
    initDeck  : initDeck,
    drawCards : drawCards,
    getDeckStat : getDeckStat,
    getImg : getImg,
  }
})();
var MAX_PLAYERS = 5,
    INIT_MONEY  = 100,
    COUNTDOWN_TIMER = 1,
    TOTAL_DECK = 1,
    MODAL_COUNTDOWN = 15,
    DEFAULT_ANTE = 5;
    MIN_BET = 0,
    ENDGAME_RESULT_TIMER = 3000;
// utility object to interact with FireBase
var YTK = YTK || {};

YTK.db = (function() {
  var 
  database = firebase.database(),
  dbPush = function(table, obj){
    database.ref(table).push(obj);
  },
  dbRemoveItem = function(key) {
    database.ref().child(key).remove();
  },
  dbBindListener = function(table, event, callback) {
    database.ref(table).on(event, callback);
  },
  dbSet = function(node, obj) {
    database.ref('/' + node).set(obj);
  },
  dbUpdate = function(node, obj, callback) {
    var noop = function() {};

    callback = callback || noop;

    database.ref('/' + node).update(obj).then(function() {
      callback();
    });
  },
  dbRemoveNode = function(node) {
    database.ref('/' + node).remove();
  };

  return {
    dbPush        : dbPush,
    dbRemoveItem  : dbRemoveItem,
    dbBind        : dbBindListener,
    dbSet         : dbSet,
    dbRemoveNode  : dbRemoveNode,
    dbUpdate      : dbUpdate
  }
})();
var YTK = YTK || {} ;

YTK.game = (function() {
  var 
  deckObj = {
    id : '',
    shuffled : false,
    remaining : 52,
    community: null
  },
  playerObj = {
    id        : -1,
    name      : '',
    avatar    : -1,
    startTime : '',
    money     : 0,
    ready     : false,
    host      : false,
    hand      : '[]',
    community : '[]',
    communityShown : -1,
    bet       : 0,
  },
  gameWinner = -1,
  gameDBListener,
  seats = [], // a 1:1 matching of seat-ID : player-ID
  stateObj = {  // keep track of various state of the program
    canPutFakeCard    : true,   // never reset
    communityDrawFree : true,   // reset
    canAssignSeat     : true,   // reset
    needPlayersStats  : true,   // never reset
    seesModal         : false,  //set to true when #optionModal displays
    givenAnte         : false,  // set to true when player makes ante for round
    allDecisionsSatisfied: false,  // to be used to justify the instance of the subsequent round
    preFlopBetsMade   : false,  // set to true when all bets are in prior to flop
    firstRoundBetsMade: false, // set to true when bets are made in the first round following the flop
    canProcessModal   : true,  // set to false when we started initModal to avoid init the same modal more than once
    initTotalPot      : false, // to see if initial total pot needs to be initialized at the start of the round
    inGameIDsUpdated  : false, // to see if the gameNode has been initialized/updated with whatever players are in the game
    r1DeckUpdate      : false, // prevent unnecessary update of deck in DB
    r2DeckUpdate      : false,
    r3DeckUpdate      : false,
    r4DeckUpdate      : false,
    endModalShown     : false,
    processWinner     : false, // start seeing who won and give them the pot
  },
  minBetHolder = 0, // for when min bet is raised through big enough bets in the round
  totalPotHolder = 0, // for updating the total pot to set in modal stats display
  turnCount = 0, //to know whose turn it is after the first turn of the round
  playersLeftInGame = 0, // to count how many players still retain their hand as game progresses   
  cardAPIFree = true, 
  connectedPlayers = [],
  database = firebase.database(),
  getLarger = function (numA, numB) {
    numA = parseInt(numA);
    numB = parseInt(numB);
    return numA >= numB ? numA : numB;
  },
  getNewMinBet = function(recentBet) {
    return recentBet - minBetHolder;
  },
  getNewTotalPot = function(recentBet) {
    return totalPotHolder + recentBet
  }
  showDiv = function($div) {
    $div.removeClass('hidden'); 
  },
  hideDiv = function($div) {
    $div.addClass('hidden');
  },
  isPlayerNode = function(node) { // is this Node a player node?
    return node.hasOwnProperty('host');
  },
  betHasBeenMade = function(node) { // did this player make a bet?
    return node.hasOwnProperty('recentBet')
  },
  updateDeckObj = function(obj) {
    deckObj.id        = obj.id;
    deckObj.shuffled  = obj.shuffled;
    deckObj.remaining = obj.remaining;
  },
  getPlayerHand = function(pObj) { // get an array of a player's hand
    return JSON.parse(pObj.hand);
  },
  endGame = function(info) {
    console.log('game ended', info);
    YTK.db.dbRemoveNode('game');
  },
  initPlayerObj = function(playerID) {
    database.ref('/' + playerID).once('value', function(snap) {
      playerObj = {
        id        : snap.val()['id'],
        name      : snap.val()['name'],
        avatar    : snap.val()['avatar'],
        startTime : snap.val()['startTime'],
        money     : snap.val()['money'],
        ready     : snap.val()['ready'],
        host      : snap.val()['host'],
      }
    });
  },
  isHost = function() {
    return playerObj.host; 
  },
  initialDraw = function(result) {
    if (result.success) {
      var handArray = [],
          $selfHand = $('.hand', '.player-0');
      // 1. update the user's hand
      for (var i = 0; i < result.cards.length; i++) {
        console.log("tjos os the thing"+result.cards[i].code);
        handArray.push(result.cards[i].code);
        putCard($selfHand, result.cards[i].code);
      }
      playerObj.hand = JSON.stringify(handArray);

      // update firebase with player's hand
      YTK.db.dbUpdate(playerObj.id, {hand : playerObj.hand});

      cardAPIFree = true;
    }
  },
  updatePlayerObj = function(newObj) {
    $.extend(playerObj, newObj);
  },
  updatePlayersArray = function(snapshot) {
    connectedPlayers = [];
    snapshot.forEach(function(snap) {
      var node = snap.val();

      if (isPlayerNode(node)) { 
        connectedPlayers.push({
          id        : node.id,
          name      : node.name,
          avatar    : node.avatar,
          startTime : node.startTime,
          money     : node.money,
          ready     : node.ready,
          host      : node.host,
          hand      : node.hand || '[]',
          bet       : node.bet,
          communityShown : node.communityShown,
        });  
      }
    });
  },
  haveHand = function(pObj) {
    return pObj.hasOwnProperty('hand') && JSON.parse(pObj.hand).length > 0;
  },
  allHaveHand = function() {
    var retVal = true;
    $.each(connectedPlayers, function(index, player) {
      if (!haveHand(player)) {
        retVal = false;
      }
    });

    return retVal;
  },
  playerNodesListener = function(snapshot) {
    updatePlayersArray(snapshot);
    updatePlayerObj(connectedPlayers[playerObj.id])
  },
  getDBGameRound = function(node) {
    if (node.hasOwnProperty('round')) {
      return node.round;
    }
    else {
      return -1;
    }
  },
  putCard = function($div, cardCode) {
    var $card = $('<div class="poker-card cardflip" id="' + cardCode +'" data-cid="' + cardCode +'">');
    var $cardFront = $('<div class="front"> <img src="' + YTK.cards.getImg(cardCode) + '" class="card-img" alt="'+cardCode+'"></div>');
    var $cardBack = $('<div class="back"> <img src="https://i.pinimg.com/originals/10/80/a4/1080a4bd1a33cec92019fab5efb3995d.png"></div></div>');
    //$card = $('</div>')
    $div.append($card);
    $div.append($cardFront);
    $div.append($cardBack);
  },
  updateDBDeck = function() {
    YTK.cards.getDeckStat(deckObj.id, function(result) {
      console.log('updating db deck', result);
      YTK.db.dbSet('deck', {
        id        : result.deck_id, 
        shuffled  : result.shuffled,
        remaining : result.remaining
      });
    });
  },
  communityDraw = function(result) {
    var communityArray = [],
        $communityCards = $('.community-area')

    for (var i = 0; i < result.cards.length; i++) {
      communityArray.push(result.cards[i].code);
      putCard($communityCards, result.cards[i].code);
    }

    playerObj.community = JSON.stringify(communityArray);
    
    //!! hacky
    playerObj.communityShown = communityArray.length - 2;
  },
  putFakeCards = function($div, total) {    
    for (var i=0; i<total; i++) {
      var $fakeCard = $('<div class="poker-card"><img src="assets/images/card-face-down.png" class="fake-card"></div>');
      $div.append($fakeCard);
    }
  },

  assignSeats = function() {
    stateObj.canAssignSeat = false;
    if (seats.length === 0 && connectedPlayers.length > 1) {
      seats.push(playerObj.id);
      $.each(connectedPlayers, function(index, player) {
        if (player.id !== playerObj.id){
          seats.push(player.id);
        }
      });
    }
    else {
      console.log('%cAssign Seat Error', 'font-weight: bold; color: red;');
    }
    stateObj.canAssignSeat = true;
  },
  putPlayerStat = function(pObj) {
    var seatID = seats.indexOf(pObj.id),
        $seat = $('.seat.player-' + seatID);

    $seat.find('.avatar').addClass('avatar-' + pObj.avatar);
    $seat.find('.name').html(pObj.name);
    $seat.find('.money').html('<i class="fa fa-usd" aria-hidden="true"></i>' + pObj.money);
  },
  /// this function will set booleans in a gameNode object which will be used to check whether a player is is still part of the game or has folded or has ran out of money
  setInGameIDs = function () {
    var inGameIDs = {};
    for (var i = 0; i < connectedPlayers.length; i++) {
      var inGameId = connectedPlayers[i].id;
      inGameIDs[inGameId] = true;
    }
    YTK.db.dbUpdate('/game/inGameIDs', inGameIDs)
  }
  // main function to determine what to do in each round
  gameRoundListener = function(snapshot) {
    var gameNode = snapshot.val()['game'],
        dbGameRound = getDBGameRound(gameNode);

    // update 'preFlopBetsMade' with firebase data
    stateObj.preFlopBetsMade = gameNode.preFlopBetsMade;

    // Handle end game, could happen at ANY round
    if (gameNode.doneTransfer && !stateObj.endModalShown) {
      stateObj.endModalShown = true; 

      if (gameWinner == -1) {
        if (gameNode.round < 3) {
          gameWinner = playerObj.id;
        }
        else {
          gameWinner = checkWhoWon();
        }  
      }
      
      initEndGameModal(gameWinner, function() {
        $('#endModal').modal({backdrop: 'static', keyboard: false});
      });

      setTimeout( function() {
        $('#endModal').modal('hide');
        restartGame();  
      }, ENDGAME_RESULT_TIMER);   
    }
    else {

      // ROUND 0: player draw two cards
      if (dbGameRound === 0) {
        console.log('%c--- ROUND '+dbGameRound+' ---', 'font-weight: bold; color: gold');

        hideDiv($('.page-loader'));

        if (stateObj.canAssignSeat && seats.length === 0) {
          assignSeats();
        }

        // update all players stat (except player 0 for now)
        if (stateObj.needPlayersStats) {

          stateObj.needPlayersStats = false;
          for (var i=1; i<seats.length; i++) {
            var player = connectedPlayers[seats[i]];
            putPlayerStat(player);
          }  
        }
        
        // deal the two cards which each user will see face up
        if (!haveHand(playerObj)) {
          if (deckObj.id !== '' && cardAPIFree) {
            cardAPIFree = false;
            console.log('> drawing 2 cards...', playerObj);
            YTK.cards.drawCards(deckObj.id, 2, function(result) {
              initialDraw(result);
            });      
          }
        }
        // FOR THE BETS BEFORE THE COMMUNITY CARD FLOP 
        else if (!stateObj.preFlopBetsMade) {
          if (!stateObj.inGameIDsUpdated) {
            stateObj.inGameIDsUpdated = true
            playersLeftInGame = connectedPlayers.length
            setInGameIDs()
          }
          // put two fake cards on table
          if (stateObj.canPutFakeCard) {
            stateObj.canPutFakeCard = false;
            for (var i=1; i < connectedPlayers.length; i++) {
              putFakeCards($('.seat.player-' + i), 2);
            }  
          }

          // turnCount start at 0, player 0 will always start first
          if (isMyTurn() && !stateObj.seesModal && playerObj.id === 0) { /// !!!!!!!!!!!!!!!!! ADDED THE THIRD CONDITION BECAUSE OF MULTIPLE FUNCTION CALLS OF INITOPTIONMODAL FOR PLAYERS WITH ID > 0
            stateObj.seesModal = true;
            initOptionModal(gameNode, displayOptionModal);
          }
          // when someone (including urself) makes a bet
          else if (betHasBeenMade(gameNode)) {
            minBetHolder = getNewMinBet(gameNode.recentBet); //// @@@@@@@@@@@@@@ PART OF FIX FOR RAISES/CALLS and below for total pot
            totalPotHolder = getNewTotalPot(gameNode.recentBet); 
            updateTurnCount();
            hideOptionModal();
            stateObj.canProcessModal = true;
            stateObj.seesModal = false;
            
            // show your modal if it's your turn
            if (isMyTurn() && stateObj.canProcessModal) {
              stateObj.canProcessModal = false;
              database.ref('/game/recentBet').remove().then(function() {
                initOptionModal(gameNode, displayOptionModal);  
              });
            }
          }
        }
        // Draw community cards, start with player id 0
        else if (stateObj.preFlopBetsMade) {
          // reset minBetHolder
          minBetHolder = 0;
          // reset turnCount before the start of next turn
          turnCount = 0;
          

          // HOST: draw commuinty card 
          if (isHost() && cardAPIFree) {
            cardAPIFree = false;
            YTK.cards.drawCards(deckObj.id, 3, function(result) {
              communityDraw(result);

              // go to round 1
              YTK.db.dbUpdate('game', {communityHand : result, howManySeeGameStats : 0, round: 1, preFlopBetsMade: false}, function() {
                // reset database "preFlopBetsMade"
                stateObj.preFlopBetsMade = false;
                YTK.db.dbUpdate(playerObj.id, {communityShown: 1, bet : 0});
              });
            });
          }        
        }
      }
      // ROUND 1: first deal of the commuinty deck
      else if (dbGameRound === 1) {
        console.log('%c--- ROUND '+dbGameRound+' ---', 'font-weight: bold; color: gold');

        if (isHost()) {
          if (!communityReady(dbGameRound) && !stateObj.r1DeckUpdate) {
            stateObj.r1DeckUpdate = true;
            updateDBDeck(); //update deck data in firebase, no drawing 
          }
        }
        else {
          if (!communityShownOnRound(dbGameRound) && stateObj.communityDrawFree) {

            stateObj.communityDrawFree = false;
       
            if (gameNode.hasOwnProperty('communityHand')) {
              communityDraw(gameNode['communityHand']);
              playerObj.communityShown = dbGameRound;

              YTK.db.dbUpdate(playerObj.id, {communityShown: dbGameRound, bet : 0});

              // reset turnCount before the start of next turn
              turnCount = 0;
            }
            stateObj.communityDrawFree = true;
          }
        }

        if (communityReady(dbGameRound)) {

          cardAPIFree = true; // done with cardAPI, reset state

          // logics here is for all the betting before we are ready
          // to give out one more community card
          if (!stateObj.preFlopBetsMade) {
            if (isMyTurn() && !stateObj.seesModal) {
              stateObj.seesModal = true;
              initOptionModal(gameNode, displayOptionModal);
            }
            // when someone (including urself) makes a bet
            else if (betHasBeenMade(gameNode)) {
              
              minBetHolder = getLarger(gameNode.recentBet, minBetHolder);
              updateTurnCount();
              hideOptionModal();
              stateObj.canProcessModal = true;
              stateObj.seesModal = false;
              
              // show your modal if it's your turn
              if (isMyTurn() && stateObj.canProcessModal) {
                stateObj.canProcessModal = false;
                database.ref('/game/recentBet').remove().then(function() {
                  initOptionModal(gameNode, displayOptionModal);  
                });
              }
            }
          }
          // ready to increament round
          else if (stateObj.preFlopBetsMade) {
            playerObj.communityShown = false;
            minBetHolder = 0;
            // reset turnCount before the start of next turn
            turnCount = 0;

            // reset communityShown for everybody
            if (isHost()) {
              handleFlop(gameNode);
            }        
          }
        }
      }
      // ROUND II | round 2
      else if (dbGameRound === 2) {
        console.log('%c--- ROUND '+dbGameRound+' ---', 'font-weight: bold; color: gold');
        
        if (isHost()) {
          if (!communityReady(dbGameRound) && !stateObj.r2DeckUpdate) {
            stateObj.r2DeckUpdate = true;
            updateDBDeck(); //update deck data in firebase, no drawing 
          }
        }
        else {
          if (!communityShownOnRound(dbGameRound) && stateObj.communityDrawFree) {

            stateObj.communityDrawFree = false;
       
            if (gameNode.hasOwnProperty('communityHand')) {
              communityDraw(gameNode['communityHand']);
              playerObj.communityShown = dbGameRound;

              YTK.db.dbUpdate(playerObj.id, {communityShown: dbGameRound, bet : 0});

              // reset turnCount before the start of next turn
              turnCount = 0;
            }
            stateObj.communityDrawFree = true;
          }
        }

        if (communityReady(dbGameRound)) {
          cardAPIFree = true;
          // logics here is for all the betting before we are ready
          // to give out one more community card
          if (!stateObj.preFlopBetsMade) {
            
            if (isMyTurn() && !stateObj.seesModal) {
              stateObj.seesModal = true;
              initOptionModal(gameNode, displayOptionModal);
            }
            // when someone (including urself) makes a bet
            else if (betHasBeenMade(gameNode)) {
              
              minBetHolder = getLarger(gameNode.recentBet, minBetHolder);
              updateTurnCount();
              hideOptionModal();
              stateObj.canProcessModal = true;
              stateObj.seesModal = false;
              
              // show your modal if it's your turn
              if (isMyTurn() && stateObj.canProcessModal) {
                stateObj.canProcessModal = false;
                database.ref('/game/recentBet').remove().then(function() {
                  initOptionModal(gameNode, displayOptionModal);  
                });
              }
            }
          }
          // ready to increament round
          else if (stateObj.preFlopBetsMade) {
            playerObj.communityShown = false;
            minBetHolder = 0;

            if (isHost()) {
              handleFlop(gameNode);
            }
          }
        }
      }

      // ROUND III, END GAME!!!
      else if (dbGameRound === 3) {
        console.log('%c--- END GAME ---', 'font-weight: bold; color: gold');
        
        if (isHost()) {
          if (!communityReady(dbGameRound) && !stateObj.r3DeckUpdate) {
            stateObj.r3DeckUpdate = true;
            updateDBDeck(); //update deck data in firebase, no drawing 
          }
        }
        else {
          if (!communityShownOnRound(dbGameRound) && stateObj.communityDrawFree) {

            stateObj.communityDrawFree = false;
       
            if (gameNode.hasOwnProperty('communityHand')) {
              communityDraw(gameNode['communityHand']);
              playerObj.communityShown = dbGameRound;
              YTK.db.dbUpdate(playerObj.id, {communityShown: dbGameRound, bet : 0});
            }
            stateObj.communityDrawFree = true;
          }
        }

        // natural game end, we need to compare poker rank
        if (communityReady(dbGameRound)) {

          if (isHost() && !stateObj.processWinner) {
            stateObj.processWinner = true;
            gameWinner = checkWhoWon();
            transferPotToWinner(gameWinner);
          }
          
        }
      }
    }
  },
  getCommunityDraws = function() {
    var $cCards = $('.poker-card', '.game-container .community-area'),
        retArr = [];

    $.each($cCards, function(index, card) {
      retArr.push($(card).attr('data-cid'));
    });
    return retArr;
  },

  checkWhoWon = function() {
    var scoreArray = [],
        solvedArray = [],
        communityCardsArr = getCommunityDraws(),
        totalCards,
        cardSolved;

    $.each(connectedPlayers, function(index, player) {
      // combine players hand with community draws
      totalCards = communityCardsArr.concat(JSON.parse(player.hand));
      
      if (totalCards.length > 0) {
        cardSolved = Hand.solve(totalCards);
        scoreArray.push(cardSolved.rank);
        solvedArray.push(cardSolved);
      }
    });

    console.log('%c---Poker Rank Comparison---', 'font-weight: bold; color: red;')
    console.log(solvedArray, scoreArray);
    // if (solvedArray.length > 0) {
    //   var p1 = solvedArray[0];
    //   var p2 = solvedArray[1];
    //   console.log('how is the score so far: ', Hand.winners([p1, p2]), );  
    // }

    // return the index with the larger "rank"
    return scoreArray.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0);
  },
  resetStateObj = function() {
    stateObj = {
      canPutFakeCard    : true,   // never reset
      communityDrawFree : true,   // reset
      canAssignSeat     : true,   // reset
      needPlayersStats  : true,   // never reset
      seesModal         : false,  //set to true when #optionModal displays
      givenAnte         : false,  // set to true when player makes ante for round
      allDecisionsSatisfied: false,  // to be used to justify the instance of the subsequent round
      preFlopBetsMade   : false,  // set to true when all bets are in prior to flop
      firstRoundBetsMade: false, // set to true when bets are made in the first round following the flop
      canProcessModal   : true,  // set to false when we started initModal to avoid init the same modal more than once
      initTotalPot      : false, // to see if initial total pot needs to be initialized at the start of the round
      inGameIDsUpdated  : false, // to see if the gameNode has been initialized/updated with whatever players are in the game
      r1DeckUpdate      : false, // prevent unnecessary update of deck in DB
      r2DeckUpdate      : false,
      r3DeckUpdate      : false,
      r4DeckUpdate      : false,
    };
  },
  transferPotToWinner = function(winnerID){
    YTK.db.dbUpdate(winnerID, {money : connectedPlayers[winnerID].money + totalPotHolder}, function() {
      YTK.db.dbUpdate('game', {doneTransfer : true });
    });
  },
  initEndGameModal = function(winnerID, callback) {
    var endModal = '#endModal';

    $('.summary .name', endModal).html(connectedPlayers[winnerID].name);
    $.each(connectedPlayers, function(index, player){
      var pDiv = '.p' + player.id;

      showDiv($(pDiv));

      if (playerObj.id === player.id) {
        $(pDiv, endModal).find('.name').html('<b>YOU</b>');  
      }
      else {
        $(pDiv, endModal).find('.name').html(player.name);  
      }
      $(pDiv, endModal).find('.money').html(player.money);
    });

    callback();
  },
  restartGame = function() {
    // clean up community cards from html and database
    $('.community-area', '.game-container').html();
    $('.poker-card', '.game-container').remove();
    database.ref().off('value', gameDBListener);

    // reset local variables
    turnCount       = 0;
    cardAPIFree     = true;
    gameWinner      = -1;
    totalPotHolder  = 0;

    if (isHost()) {
      database.ref('/game').child('communityHand').remove().then(function() {
        YTK.db.dbUpdate('game', {doneTransfer : false}, function() {
          YTK.db.dbUpdate(playerObj.id, {hand : '', bet : 0, communityShown : -1}, function() {
            resetStateObj();
            initGame(playerObj.id);            
          });
        });
      })
    }
    else {
      showDiv($('.page-loader'));
      setTimeout(function() {
        YTK.db.dbUpdate(playerObj.id, {hand : '', bet : 0, communityShown : -1}, function() {
          resetStateObj();
          initGame(playerObj.id);            
        });
      }, 1000);  
    }
  },
  communityShownOnRound = function(round) {
    return playerObj.communityShown === round;
  },
  
  // 1. draw card from cardAPI 
  // 2. update firebase with newly drawn community card
  // 3. update firebase with round ++
  handleFlop = function(gameNode) {
    var totalDraw = 0,
        upcomingRound = gameNode.round + 1;

    if (gameNode.round === 0) {
      totalDraw = 3;
    }
    else if (gameNode.round > 0 && gameNode.round < 3) {
      totalDraw = 1;
    }

    if (cardAPIFree) {
      cardAPIFree = false;
      YTK.cards.drawCards(deckObj.id, totalDraw, function(result) {
        communityDraw(result);
        YTK.db.dbUpdate('game', {communityHand : result, howManySeeGameStats : 0, preFlopBetsMade: false, round : upcomingRound}, function() {
          YTK.db.dbUpdate(playerObj.id, {communityShown : upcomingRound, bet : 0});
        });
      });
    }        
  },
  whosTurn = function() {
    return turnCount % connectedPlayers.length;
  },
  isMyTurn = function() {
    return playerObj.id === whosTurn();
  },
  updateTurnCount = function() {
    turnCount++;
  },
  anteReady = function(gameNode) {
    var allPaid = true,
        afterAnte = INIT_MONEY - DEFAULT_ANTE;

    for (var i=0; i<connectedPlayers.length; i++) {
      if (connectedPlayers[i]['money'] !== afterAnte) {
        allPaid = false;
        break;
      }
    }
    return allPaid;
  },
  updateDBPot = function(totPot) {
    YTK.db.dbUpdate('game', {totalPot :totPot});
  },
  setGameStatsInModal = function(gameNode) {
    var othersMoney = [],
        $potDiv = $('.amount', '.pot-total');
        $callAmt = $('.btn-call .amount', '#optionModal'),

    $potDiv.html(totalPotHolder);
    $callAmt.html(minBetHolder);

    othersMoney = getOthersMoney(othersMoney);

    for (var i = 0; i < othersMoney.length; i++) {
      var $pDiv = $('.p-money.p-' + othersMoney[i].id, '#optionModal');
      showDiv($pDiv);
      $pDiv.find('.name').html(othersMoney[i].name);
      $pDiv.find('.amount').html(othersMoney[i].money);
    }
  },
  getOthersMoney = function(array) {
    var retVal = [];

    $.each(connectedPlayers, function(index, player) {
      if (player.id !== playerObj.id) {
        retVal.push( { id : player.id, 
                       name : player.name,
                       money : player.money,} );
      }
    });
    return retVal;
  },
  playerMakesBet = function(bet) {
    var count = playerObj.money;
        bet = Math.floor(bet);

    playerObj.bet = playerObj.bet || 0;

    if (playerObj.money >= bet && bet >= MIN_BET) {
      count = playerObj.money - bet;
      playerObj.money = count;

      YTK.db.dbUpdate(playerObj.id, {money: count, bet: playerObj.bet + bet}, function() {
        YTK.db.dbUpdate('game', {recentBet : bet});  
      });
    }
    else if (!(playerObj.money) >= bet && bet >= MIN_BET) {
      console.log('%cNot enough money to make bet', 'font-weight: bold; color: red;');
    }
    else if (playerObj.money >= bet && !(bet >= MIN_BET) ) {
      console.log('%cNeed to make bigger bet', 'font-weight: bold; color: red;')
    }
  },
  communityReady = function(round) {
    var retVal = true;

    for (var i = 0; i < connectedPlayers.length; i++) {
      if (connectedPlayers[i].communityShown !== round) {
        retVal = false;
        break;
      }
    }
    return retVal;
  },
  displayOptionModal = function() {
    var $optModal = $('#optionModal');
    $optModal.modal({backdrop: 'static', keyboard: false});  
  },
  hideOptionModal = function() {
    var $optModal = $('#optionModal');
    $optModal.modal('hide');
  },
  setupLocalTimer = function() {
    var localTimer,
        timer   = MODAL_COUNTDOWN,
        $timer  = $('.timer', '#optionModal');

    localTimer = setInterval(function() {
      if (timer === 0) {
        clearInterval(localTimer);
        console.log('times up! auto press "check"');
      }
      $timer.html(timer);
      timer --;
    }, 1000);
  },
  canCheck = function() {
    if (minBetHolder === 0) {
      var allEqual = true;
    } 
    else {
      var allEqual = false;
    }
    return allEqual;
  },
  grabCommunityCards = function() {
    var $communityArea = $('.community-area', '.game-container'),
        $modalCCards   = $('.community-cards', '#optionModal'),
        communityCards = $communityArea.html();

    if (communityCards !== '') {
      $modalCCards.html($communityArea.html())  
    }
  },
  initOptionModal = function(gameNode, callback) {
    var $optionModal = $('#optionModal'),
        $money    = $('.user-money .amount', '#optionModal'),
        $betBtn   = $('.btn-makeBet', '#optionModal'),
        $checkBtn = $('.btn-check', '#optionModal'),
        $callBtn = $('.btn-call', '#optionModal'),
        $foldBtn  = $('.btn-fold', '#optionModal'),
        $minBet   = $('.min-bet', '#optionModal'),
        $betTxtBox = $('.bet-amount', '#optionModal'),
        myBet = playerObj.bet || 0;

    setGameStatsInModal(gameNode);
    grabCommunityCards();
    $money.html(playerObj.money);  // update user money
    $minBet.html('Minimum Bet: ' + minBetHolder);
    $betTxtBox.val('');
    
    // for the very first turn of each round
    if (turnCount === 0) {
      hideDiv($callBtn);
      showDiv($checkBtn)
      $betBtn.html('Initial Bet');
    }
    else {
      if (canCheck()) {
        showDiv($checkBtn);
        hideDiv($callBtn)
      }
      else {
        showDiv($callBtn);  
        hideDiv($checkBtn)
      }      
      $betBtn.html('Raise');
    }

    // setup "check" button
    // case 1: last player on quene clicked: end turn
    if (turnCount !== 0 && whosTurn() === connectedPlayers.length - 1) {
      $checkBtn.off().on('click', function() {
        
        // close modal
        hideOptionModal();
        stateObj.seesModal = false;

        stateObj.preFlopBetsMade = true;
        YTK.db.dbUpdate('game', {preFlopBetsMade: true});
      });
    }
    else {
      $checkBtn.off().on('click', function() {
        playerMakesBet(minBetHolder);  // trigger modal exchange
      })
    }

    // setup "fold" button, only works if there are 2 players left
    if (playersLeftInGame === 2) {
      $foldBtn.off().on('click', function() {
        hideOptionModal();
        stateObj.seesModal = false;
        
        // transfer pot to "the other player"
        for (var i = 0; i < connectedPlayers.length; i++) {
          if (connectedPlayers[i].id !== playerObj.id) {
            gameWinner = connectedPlayers[i].id;
            transferPotToWinner(connectedPlayers[i].id);    
          }
        }

      });
    }

    // setup "bet" ("raise") button
    $betBtn.off().on('click', function() {
      var bet = Math.floor(parseInt($('.bet-amount').val())) + minBetHolder;
      playerMakesBet(bet); // update Firebase \player's Node
    });
    $('.bet-amount', '#optionModal').off().on('keyup', function(e) {
      if (e.keyCode == 13) {
        var bet = Math.floor(parseInt($('.bet-amount').val())) + minBetHolder;
        playerMakesBet(bet); // update Firebase \player's Node
      }
    });
    
    // setup the "call" button
    $callBtn.off().on('click', function() {
      playerMakesBet(minBetHolder);
    });

    callback();
  },
  setDeckListener = function(snapshot) {
    var snap = snapshot.val();
    if (snap.hasOwnProperty('deck')) {
      updateDeckObj({
        id        : snap['deck'].id,
        shuffled  : snap['deck'].shuffled,
        remaining : snap['deck'].remaining
      });
    }
  },
  setDBListener = function() { // listen to all firebase changes
    gameDBListener = database.ref().on('value', function(snapshot) {
      console.log('(DB-Value, game)', snapshot.val());

      // on DB deck change: update local deck
      setDeckListener(snapshot);
      
      // on DB player change: update local players
      playerNodesListener(snapshot);

      // on DB game.round: determine what to do
      gameRoundListener(snapshot);
    });
  },
  initGame = function(playerID) {
    showDiv($('.page-loader'));

    hideDiv($('.login-container'));
    showDiv($('.game-container'));

    initPlayerObj(playerID);

    setDBListener();

    if (isHost()) {
      YTK.cards.initDeck(TOTAL_DECK, function(result) {
        
        if (result.success) {
          updateDeckObj({
            id : result.deck_id,
            shuffled : result.shuffled,
            remaining : result.remaining
          });

          // start of ROUND 0
          YTK.db.dbUpdate('game', {round : 0});
          // push deck to firebase
          YTK.db.dbSet('deck', deckObj);
        }
        else {
          endGame('Error getting a deck');
        }
      });  
    }
  };

  return {
    start : initGame
  }
})();

$(document).on('gameStarted', function(e, playerID) {
  YTK.game.start(playerID);
});
/*! flip - v1.1.2 - 2016-10-20
* https://github.com/nnattawat/flip
* Copyright (c) 2016 Nattawat Nonsung; Licensed MIT */
(function( $ ) {
  /*
   * Private attributes and method
   */

  // Function from David Walsh: http://davidwalsh.name/css-animation-callback licensed with http://opensource.org/licenses/MIT
  var whichTransitionEvent = function() {
    var t, el = document.createElement("fakeelement"),
    transitions = {
      "transition"      : "transitionend",
      "OTransition"     : "oTransitionEnd",
      "MozTransition"   : "transitionend",
      "WebkitTransition": "webkitTransitionEnd"
    };

    for (t in transitions) {
      if (el.style[t] !== undefined) {
        return transitions[t];
      }
    }
  };

  /*
   * Model declaration
   */
  var Flip = function($el, options, callback) {
    // Define default setting
    this.setting = {
      axis: "y",
      reverse: false,
      trigger: "click",
      speed: 500,
      forceHeight: false,
      forceWidth: false,
      autoSize: true,
      front: '.front',
      back: '.back'
    };

    this.setting = $.extend(this.setting, options);

    if (typeof options.axis === 'string' && (options.axis.toLowerCase() === 'x' || options.axis.toLowerCase() === 'y')) {
      this.setting.axis = options.axis.toLowerCase();
    }

    if (typeof options.reverse === "boolean") {
      this.setting.reverse = options.reverse;
    }

    if (typeof options.trigger === 'string') {
      this.setting.trigger = options.trigger.toLowerCase();
    }

    var speed = parseInt(options.speed);
    if (!isNaN(speed)) {
      this.setting.speed = speed;
    }

    if (typeof options.forceHeight === "boolean") {
      this.setting.forceHeight = options.forceHeight;
    }

    if (typeof options.forceWidth === "boolean") {
      this.setting.forceWidth = options.forceWidth;
    }

    if (typeof options.autoSize === "boolean") {
      this.setting.autoSize = options.autoSize;
    }

    if (typeof options.front === 'string' || options.front instanceof $) {
      this.setting.front = options.front;
    }

    if (typeof options.back === 'string' || options.back instanceof $) {
      this.setting.back = options.back;
    }

    // Other attributes
    this.element = $el;
    this.frontElement = this.getFrontElement();
    this.backElement = this.getBackElement();
    this.isFlipped = false;

    this.init(callback);
  };

  /*
   * Public methods
   */
  $.extend(Flip.prototype, {

    flipDone: function(callback) {
      var self = this;
      // Providing a nicely wrapped up callback because transform is essentially async
      self.element.one(whichTransitionEvent(), function() {
        self.element.trigger('flip:done');
        if (typeof callback === 'function') {
          callback.call(self.element);
        }
      });
    },

    flip: function(callback) {
      if (this.isFlipped) {
        return;
      }

      this.isFlipped = true;

      var rotateAxis = "rotate" + this.setting.axis;
      this.frontElement.css({
        transform: rotateAxis + (this.setting.reverse ? "(-180deg)" : "(180deg)"),
        "z-index": "0"
      });

      this.backElement.css({
        transform: rotateAxis + "(0deg)",
        "z-index": "1"
      });
      this.flipDone(callback);
    },

    unflip: function(callback) {
      if (!this.isFlipped) {
        return;
      }

      this.isFlipped = false;

      var rotateAxis = "rotate" + this.setting.axis;
      this.frontElement.css({
        transform: rotateAxis + "(0deg)",
        "z-index": "1"
      });

      this.backElement.css({
        transform: rotateAxis + (this.setting.reverse ? "(180deg)" : "(-180deg)"),
        "z-index": "0"
      });
      this.flipDone(callback);
    },

    getFrontElement: function() {
      if (this.setting.front instanceof $) {
        return this.setting.front;
      } else {
        return this.element.find(this.setting.front);
      }
    },

    getBackElement: function() {
      if (this.setting.back instanceof $) {
        return this.setting.back;
      } else {
        return this.element.find(this.setting.back);
      }
    },

    init: function(callback) {
      var self = this;

      var faces = self.frontElement.add(self.backElement);
      var rotateAxis = "rotate" + self.setting.axis;
      var perspective = self.element["outer" + (rotateAxis === "rotatex" ? "Height" : "Width")]() * 2;
      var elementCss = {
        'perspective': perspective,
        'position': 'absolute'
      };
      var backElementCss = {
        "transform": rotateAxis + "(" + (self.setting.reverse ? "180deg" : "-180deg") + ")",
        "z-index": "0",
        "position": "absolute"
      };
      var faceElementCss = {
        "backface-visibility": "hidden",
        "transform-style": "preserve-3d",
        "position": "absolute",
        "z-index": "1"
      };

      if (self.setting.forceHeight) {
        faces.outerHeight(self.element.height());
      } else if (self.setting.autoSize) {
        faceElementCss.height = '100%';
      }

      if (self.setting.forceWidth) {
        faces.outerWidth(self.element.width());
      } else if (self.setting.autoSize) {
        faceElementCss.width = '100%';
      }

      // Back face always visible on Chrome #39
      if ((window.chrome || (window.Intl && Intl.v8BreakIterator)) && 'CSS' in window) {
        //Blink Engine, add preserve-3d to self.element
        //elementCss["-webkit-transform-style"] = "preserve-3d";
      }


      faces.css(faceElementCss).find('*').css({
        "backface-visibility": "hidden"
      });

      self.element.css(elementCss);
      self.backElement.css(backElementCss);

      // #39
      // not forcing width/height may cause an initial flip to show up on
      // page load when we apply the style to reverse the backface...
      // To prevent self we first apply the basic styles and then give the
      // browser a moment to apply them. Only afterwards do we add the transition.
      setTimeout(function() {
        // By now the browser should have applied the styles, so the transition
        // will only affect subsequent flips.
        var speedInSec = self.setting.speed / 1000 || 0.5;
        faces.css({
          "transition": "all " + speedInSec + "s ease-out"
        });

        // This allows flip to be called for setup with only a callback (default settings)
        if (typeof callback === 'function') {
          callback.call(self.element);
        }

        // While this used to work with a setTimeout of zero, at some point that became
        // unstable and the initial flip returned. The reason for this is unknown but we
        // will temporarily use a short delay of 20 to mitigate this issue.
      }, 20);

      self.attachEvents();
    },

    clickHandler: function(event) {
      if (!event) { event = window.event; }
      if (this.element.find($(event.target).closest('button, a, input[type="submit"]')).length) {
        return;
      }

      if (this.isFlipped) {
        this.unflip();
      } else {
        this.flip();
      }
    },

    hoverHandler: function() {
      var self = this;
      self.element.off('mouseleave.flip');

      self.flip();

      setTimeout(function() {
        self.element.on('mouseleave.flip', $.proxy(self.unflip, self));
        if (!self.element.is(":hover")) {
          self.unflip();
        }
      }, (self.setting.speed + 150));
    },

    attachEvents: function() {
      var self = this;
      if (self.setting.trigger === "click") {
        self.element.on($.fn.tap ? "tap.flip" : "click.flip", $.proxy(self.clickHandler, self));
      } else if (self.setting.trigger === "hover") {
        self.element.on('mouseenter.flip', $.proxy(self.hoverHandler, self));
        self.element.on('mouseleave.flip', $.proxy(self.unflip, self));
      }
    },

    flipChanged: function(callback) {
      this.element.trigger('flip:change');
      if (typeof callback === 'function') {
        callback.call(this.element);
      }
    },

    changeSettings: function(options, callback) {
      var self = this;
      var changeNeeded = false;

      if (options.axis !== undefined && self.setting.axis !== options.axis.toLowerCase()) {
        self.setting.axis = options.axis.toLowerCase();
        changeNeeded = true;
      }

      if (options.reverse !== undefined && self.setting.reverse !== options.reverse) {
        self.setting.reverse = options.reverse;
        changeNeeded = true;
      }

      if (changeNeeded) {
        var faces = self.frontElement.add(self.backElement);
        var savedTrans = faces.css(["transition-property", "transition-timing-function", "transition-duration", "transition-delay"]);

        faces.css({
          transition: "none"
        });

        // This sets up the first flip in the new direction automatically
        var rotateAxis = "rotate" + self.setting.axis;

        if (self.isFlipped) {
          self.frontElement.css({
            transform: rotateAxis + (self.setting.reverse ? "(-180deg)" : "(180deg)"),
            "z-index": "0"
          });
        } else {
          self.backElement.css({
            transform: rotateAxis + (self.setting.reverse ? "(180deg)" : "(-180deg)"),
            "z-index": "0"
          });
        }
        // Providing a nicely wrapped up callback because transform is essentially async
        setTimeout(function() {
          faces.css(savedTrans);
          self.flipChanged(callback);
        }, 0);
      } else {
        // If we didnt have to set the axis we can just call back.
        self.flipChanged(callback);
      }
    }

  });

  /*
   * jQuery collection methods
   */
  $.fn.flip = function (options, callback) {
    if (typeof options === 'function') {
      callback = options;
    }

    if (typeof options === "string" || typeof options === "boolean") {
      this.each(function() {
        var flip = $(this).data('flip-model');

        if (options === "toggle") {
          options = !flip.isFlipped;
        }

        if (options) {
          flip.flip(callback);
        } else {
          flip.unflip(callback);
        }
      });
    } else {
      this.each(function() {
        if ($(this).data('flip-model')) { // The element has been initiated, all we have to do is change applicable settings
          var flip = $(this).data('flip-model');

          if (options && (options.axis !== undefined || options.reverse !== undefined)) {
            flip.changeSettings(options, callback);
          }
        } else { // Init
          $(this).data('flip-model', new Flip($(this), (options || {}), callback));
        }
      });
    }

    return this;
  };

}( jQuery ));

//TODO: QA login/dc logic
var YTK = YTK || {};

YTK.login = (function() {
  var 
  database = firebase.database(),
  playerObj = {
    id        : -1,
    name      : '',
    avatar    : -1,
    startTime : '',
    money     : 0,
    ready     : false,
    host      : false
  },
  countdownInterval = null,
  connectedPlayers = [],
  startCounter,
  loginDBListener,
  gameStarted = false,
  showDiv = function($div) {
    $div.removeClass('hidden');
  },
  hideDiv = function($div) {
    $div.addClass('hidden');
  },
  getAvailableUserID = function(snapshot) {
    for (var i=0; i < MAX_PLAYERS; i++) {
      if (!snapshot.hasChild(i + '')) {
        return i;
      }
    }
    return -1;
  },
  isGameFull = function(snapshot) {
    return getAvailableUserID(snapshot) === -1;
  },
  setPlayerObj = function(userObj) {
    playerObj = userObj;
  },
  addConnectedPlayer = function(pObj) {
    var $pRow   = $('<div class="player player-' + pObj.id +'" data-pid="' + pObj.id + '">'),
        $pName  = $('<span class="name">' + pObj.name + '</span>'),
        $pWait  = $('<span class="status hidden">Waiting...</span>'),
        $pReady = $('<span class="status hidden">Ready!</span>'),
        $pDC    = $('<button class="btn btn-outline-danger dc-btn">Quit</button>'),
        $pBtn   = $('<button class="btn btn-outline-success ready-btn" data-id="' + playerObj.id +'">Ready</button>');

      $pRow.append($pName);

      if (playerObj.id == pObj.id) {
        $pRow.append($pDC);
        if (!pObj.ready) {
          $pRow.append($pBtn);
        }
      }
      else {
        if (pObj.ready) {
          $pRow.append($pReady);
        }
        else {
          $pRow.append($pWait);  
        }
      }

      $('.connected-players').append($pRow);
  },
  bindDCBtn = function() {
    $('.connected-players').on('click', 'dc-btn', function() {
      if (playerObj.id !== -1) {
        YTK.db.dbRemoveNode(playerObj.id);
      }
    });
  },
  bindReadyBtn = function() {
    $('.connected-players').on('click', '.ready-btn', function() {

      if (connectedPlayers.length > 1) {
        playerObj.ready = true;

        // update firebase
        YTK.db.dbSet(playerObj.id, playerObj);

        // start countdown
        startCountdown();
      }
    });
  },
  isPlayerNode = function(node) { // is this Node a player node?
    return node.hasOwnProperty('host');
  },
  getOnlinePlayers = function(snapshot) {

    connectedPlayers = [];
    snapshot.forEach(function(snap) {
      var node = snap.val();

      if (isPlayerNode(node)) { 
        connectedPlayers.push({
          id        : node.id,
          name      : node.name,
          avatar    : node.avatar,
          startTime : node.startTime,
          money     : node.money,
          ready     : node.ready,
          host      : node.host,
        });

        addConnectedPlayer({
          id    : node.id,
          name  : node.name,
          ready : node.ready,
          host  : node.host,
        });
      }
    });
  },
  handleJoinGame = function() {
    var userName = $('.username', '.user-form').val().trim();

    if (userName !== '') {
      hideDiv($('.user-form'));
      database.ref().once('value', function(snapshot) {

        //display all players currently logged in
        getOnlinePlayers(snapshot);

        if (isGameFull(snapshot)) { // game is full
          console.log('game is full dude');
        }

        else {
          var userID = getAvailableUserID(snapshot);

          showDiv($('.connected-players'));

          if (userID !== -1) {
            // init player object
            setPlayerObj({
              id        : userID,
              name      : userName,
              avatar    : playerObj.avatar,
              startTime : Date.now(),
              money     : INIT_MONEY,
              ready     : false,
              host      : false,
            });
            
            // push to database
            YTK.db.dbSet(userID, playerObj);

            // start DB event listener
            bindDBListener();
          }
        }
      });
    }
  },
  bindJoinBtn = function() {
    var $joinBtn = $('.join-btn');

    $joinBtn.on('click', function() {
      handleJoinGame();
    });

    $('.username', '.user-form').on('keyup', function(e) {
      if (e.keyCode == 13) {
        handleJoinGame();
      }
    });
  },
  bindAvatarSelect = function() {
    var $avatarBtn = $('.avatar', '.avatar-select');

    $avatarBtn.on('click', function() {
      var $this = $(this),
          $loginTitle = $('.title h1', '.login-container');

      $loginTitle.fadeOut('slow');
      $this.addClass('picked');
      playerObj.avatar = parseInt($(this).attr('data-id'));
      showDiv($('.user-form', '.login-container'));
      hideDiv($avatarBtn.not('.picked').closest('.col-lg-4'));
      $this.off('click');
    });

  },
  setAllUnready = function() {
    database.ref().once('value', function(snapshot) {
      snapshot.forEach(function(snap) {
        var node = snap.val();

        if (node.hasOwnProperty('id') && node.ready === true) {
          node.ready = false;
          YTK.db.dbUpdate(node.id, node);
        }
      });
    });
  },
  // remove user table from DB if a user disconnected
  bindDisconnect = function() {
    $(window).bind("beforeunload", function() {
      
      if (playerObj.id !== -1) {

        YTK.db.dbRemoveNode(playerObj.id);

        if (countdownInterval !== null) {
          clearInterval(countdownInterval);  
        }

        if (playerObj.ready === true) {
          YTK.db.dbRemoveNode('countdown');
          setAllUnready(); 
        }

        // end the game session if the disconnecting player is the host of the game
        // TODO: shift host when that happens
        if (playerObj.host === true) {
          YTK.db.dbRemoveNode('game');
          YTK.db.dbRemoveNode('deck');
        }
      }
      
      return undefined;
    });
  },
  clearDiv = function($div) {
    $div.empty();
  },
  hasReadyPlayers = function(snapshot) {

    var retVal = false;

    snapshot.forEach(function(snap) {
      var node = snap.val();

      if (node.ready == true) {
        retVal = true;
      }
    });

    return retVal;
  },

  resetStartCounter = function() {
    startCounter = COUNTDOWN_TIMER;
  },

  showPlayersStatus = function() {
    var $status = $('.status', '.network-info');

    showDiv($status);
  },
  countDownListener = function(snapshot) {

    if (snapshot.hasChild('countdown')) { // if counter exist
      playerObj.ready = snapshot.val()[playerObj.id].ready;
      $('.start-counter').html(snapshot.val()['countdown']);
      showPlayersStatus();
    }
    else {
      playerObj.ready = false;
      $('.start-counter').html('');
    }
  },
  getHostID = function() {
    var hostID = -1;
    for (var i=0; i < connectedPlayers.length; i++) {
      if (connectedPlayers[i].host) {
        hostID = connectedPlayers[i].id;
        break;
      }
    }
    if (hostID === -1) {
      hostID = connectedPlayers[0].id;
    }
    return hostID;
  },
  gameCanStart = function() {
    return connectedPlayers.length > 1 && getHostID() >= 0;
  },
  setToHost = function() {
    playerObj.host = true;
    YTK.db.dbUpdate(playerObj.id, {host : true});
  },
  startCountdown = function() {
    database.ref().once('value', function(snapshot) {
      if (!snapshot.hasChild('countdown')) {

        setToHost();  // set this player to host

        resetStartCounter();

        // YTK.db.dbSet('countdown', startCounter);

        countdownInterval = setInterval(function() {

          YTK.db.dbSet('countdown', startCounter);

          if (startCounter === 0) {
            clearInterval(countdownInterval);
            resetStartCounter();

            YTK.db.dbRemoveNode('countdown');
            
            //double check to make sure more than 1 players are ready
            if (gameCanStart()) {
              YTK.db.dbSet('game', {
                hostID    : getHostID(),
                startTime : Date.now(),
              });
            }
          }
          else {
            startCounter --;  
          }

        }, 1000);    
      }
    });
  },
  updateRdyBtn = function() {
    var $rdyBtns = $('.ready-btn');
    if (connectedPlayers.length === 1) {
      $rdyBtns.prop('disabled', true);
      $rdyBtns.addClass('btn-outline-secondary');
      $rdyBtns.removeClass('btn-outline-success');
    }
    else {
      $rdyBtns.prop('disabled', false);
      $rdyBtns.removeClass('btn-outline-secondary');
      $rdyBtns.addClass("btn-outline-success");
    }
  },
  gameStartListener = function(snapshot) {
    if (!gameStarted && snapshot.hasChild('game')) {
      gameStarted = true;
      triggerGameStart();
      database.ref().off('value', loginDBListener); //turn off main login listener
    }
  },
  bindDBListener = function() {
    loginDBListener = database.ref().on('value', function(snapshot) {
      if (!gameStarted) {
        clearDiv($('.connected-players', '.login-container'));
        countDownListener(snapshot);
        getOnlinePlayers(snapshot);
        updateRdyBtn();
        gameStartListener(snapshot);
        // console.log('(DB-Value, login)', snapshot.val());  
      }
    });
  },
  bindQuitBtn = function() {
    $('.connected-players').on('click', '.dc-btn', function() {
      location.reload();
    });
  },
  triggerGameStart = function(){
    $( document ).trigger("gameStarted", playerObj.id);
  },
  initLogin = function() {
    bindDisconnect();
    bindQuitBtn();

    // login page
    bindAvatarSelect();
    bindJoinBtn();
    bindReadyBtn();
    bindDCBtn();
  };

  return {
    initLogin : initLogin
  }
})();

$(function() {
  YTK.login.initLogin();
});
$("#card1").flip();
$("#card2").flip();
$("#card3").flip();
$("#card4").flip();
$("#card5").flip();
$("#card6").flip();
$("#card7").flip();
$("#card8").flip();


$('.cardflip').click(function () {
  console.log("ehjfaslfjaklosdf");
  $('.cardflip').flip();
});

$('.stack').click(function () {

  $(".card").each(function (e) {

    setTimeout(function () {
      $(".card").eq(e).attr("class", "card");
    }, e * 150)

  });

});

$('.spread').click(function () {

  $(".card").each(function (e) {

    setTimeout(function () {
      $(".card").eq(e).attr("class", "card ani" + e);
    }, e * 150)

  });

});

$('.shuffle').click(function () {
  console.log("shuffling");

  $(".card").each(function (e) {

    setTimeout(function () {
      $(".card").eq(e).attr("class", "card ani" + e);
    }, e * 150)

  });

  setTimeout(function () {
    $(".card").each(function (e) {

      setTimeout(function () {
        $(".card").eq(e).attr("class", "card");
      }, e * 150)

    });
  }, 500);


});