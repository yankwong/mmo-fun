$("#card1").flip();
$("#card2").flip();
$("#card3").flip();
$("#card4").flip();
$("#card5").flip();
$("#card6").flip();
$("#card7").flip();
$("#card8").flip();

$("UserCard0").flip();
$("UserCard1").flip();
$("UserCard2").flip();

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