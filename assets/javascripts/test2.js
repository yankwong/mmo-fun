$("#card1").flip();
$("#card2").flip();
$("#card3").flip();
$("#card4").flip();
$("#card5").flip();
$("#card6").flip();
$("#card7").flip();
$("#card8").flip();



$(document).on("click", "#UserCard0", function(event){
  $("#UserCard0").flip();
});
$(document).on("click", "#UserCard1", function(event){
  $("#UserCard1").flip();
});


$('.stack').click(function () {

  $(".cardflip").each(function (e) {

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