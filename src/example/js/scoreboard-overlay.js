$(function() {
    // Ruta al JSON del scoreboard (ajusta si es necesario)
    const jsonPath = 'json/scoreboard.json';
    let lastData = '';
    let firstLoad = true;

    // Opcional: función para obtener la bandera según el jugador (ajusta según tu app)
    function getFlag(country) {
        if (!country) return "";
        return `https://flagcdn.com/${country.toLowerCase()}.svg`;
    }

    function renderScoreboard(data) {
        let p1Name = data.player1 || '';
        if (data.player1b) {
            p1Name += ' / ' + data.player1b;
        }
        let p2Name = data.player2 || '';
        if (data.player2b) {
            p2Name += ' / ' + data.player2b;
        }
        
        let p1Tag = data.tag1 || '';
        if (data.tag1b) {
            p1Tag += ' / ' + data.tag1b;
        }
        let p2Tag = data.tag2 || '';
        if (data.tag2b) {
            p2Tag += ' / ' + data.tag2b;
        }

        $('#name1').text(p1Name);
        $('#name2').text(p2Name);
        $('#score1').text(data.score1 ?? '');
        $('#score2').text(data.score2 ?? '');
        $('#tag1').text(p1Tag).toggle(!!p1Tag);
        $('#tag2').text(p2Tag).toggle(!!p2Tag);

        // Bandera: si tienes campo en JSON, úsalo; si no, usa getFlag()
        $('#flag1').attr('src', getFlag(data.country1)).toggle(!!data.country1);
        $('#flag2').attr('src', getFlag(data.country2)).toggle(!!data.country2);

        // Info extra (ronda, juego, etc.)
        let info = [];
        if (data.round) info.push(data.round);
        if (data.game) info.push(data.game);
        $('#scoreboard-info').text(info.join(" | "));
    }

    function showBar() {
        gsap.fromTo('#scoreboard-bar',
            { y: -80, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" }
        );
    }

    function updateScoreboard() {
        $.getJSON(jsonPath, function(data) {
            const dataStr = JSON.stringify(data);
            if (dataStr !== lastData) {
                lastData = dataStr;
                renderScoreboard(data);
                if (firstLoad) {
                    showBar();
                    firstLoad = false;
                }
            }
        });
    }

    // Llama una vez al cargar
    updateScoreboard();

    // Actualiza automáticamente cada 2 segundos
    setInterval(updateScoreboard, 2000);

    // Exponer para recarga manual si lo deseas
    window.updateScoreboard = updateScoreboard;
});