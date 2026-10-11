(function () {
	var started = false, score = 0, y = 0, v = 0, timer;
	var player = document.getElementById('player');
	var scoreEl = document.getElementById('score');
	var status = document.getElementById('status');
	var game = document.getElementById('game');

	function flap() {
		if (!started) return;
		v = -5;
		player.style.transform = 'translateY(-8px)';
		setTimeout(function () { player.style.transform = ''; }, 120);
	}

	function start() {
		started = true; score = 0; y = 0; v = -4; scoreEl.textContent = '0';
		status.textContent = 'Ketuk area biru untuk terbang!';
		clearInterval(timer);
		timer = setInterval(function () {
			v += 0.65; y += v;
			if (y > 70) { y = 70; v = -2; }
			if (y < -55) { y = -55; }
			player.style.top = 'calc(45% + ' + y + 'px)';
			if (Math.random() < 0.08) { score++; scoreEl.textContent = String(score); }
		}, 80);
	}

	document.getElementById('start').onclick = start;
	game.onclick = flap;
	game.ontouchstart = flap;
})();
