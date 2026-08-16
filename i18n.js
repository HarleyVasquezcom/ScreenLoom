'use strict';

const I18N = {
  en: {
    appTitle: 'ScreenLoom', tagline: 'studio recorder for the browser',
    toggle: '[ start / stop recording ]', recOn: 'REC', recOff: 'IDLE',
    recChrome: '– capture runs inside the popup page –', hint: 'click start, share a tab/window/screen, the tape rolls with a red REC on every page; stop saves a clip card',
    clipsTitle: 'recorded clips', seqLabel: 'clips', emptyClips: 'no clips yet — record your first one',
    durLabel: 'duration', mimeLabel: 'mime', nameLabel: 'name', thumbLabel: 'preview',
    newName: 'new clip', downloads: '.webm available this session; card metadata stays',
    clearBtn: '[ clear clips ]', clearOk: 'clips cleared', captureFail: 'capture denied or unavailable',
    exportOk: 'clip ready — check downloads', statusOn: 'recording', statusOff: 'idle',
    credit: 'Built by Harley Vásquez',
  },
  es: {
    appTitle: 'ScreenLoom', tagline: 'grabador de estudio para el navegador',
    toggle: '[ iniciar / detener grabación ]', recOn: 'REC', recOff: 'IDLE',
    recChrome: '– la captura corre dentro del popup –', hint: 'pulsa iniciar, comparte pestaña/ventana/pantalla, la cinta corre con un REC rojo en cada página; detener guarda una ficha de clip',
    clipsTitle: 'clips grabados', seqLabel: 'clips', emptyClips: 'aún sin clips — graba el primero',
    durLabel: 'duración', mimeLabel: 'mime', nameLabel: 'nombre', thumbLabel: 'vista',
    newName: 'clip nuevo', downloads: '.webm disponible esta sesión; la ficha queda guardada',
    clearBtn: '[ borrar clips ]', clearOk: 'clips borrados', captureFail: 'captura denegada o no disponible',
    exportOk: 'clip listo — mira tus descargas', statusOn: 'grabando', statusOff: 'inactivo',
    credit: 'Creado por Harley Vásquez',
  },
  fr: {
    appTitle: 'ScreenLoom', tagline: 'enregistreur studio pour le navigateur',
    toggle: '[ démarrer / arrêter l\u2019enregistrement ]', recOn: 'REC', recOff: 'IDLE',
    recChrome: '– la capture tourne dans le popup –', hint: 'cliquez démarrer, partagez un onglet/une fenêtre/l\u2019écran, la bande tourne avec un REC rouge sur chaque page ; arrêter enregistre une fiche clip',
    clipsTitle: 'clips enregistrés', seqLabel: 'clips', emptyClips: 'aucun clip pour l\u2019instant — enregistrez le premier',
    durLabel: 'durée', mimeLabel: 'mime', nameLabel: 'nom', thumbLabel: 'aperçu',
    newName: 'nouveau clip', downloads: '.webm disponible cette session ; la fiche reste',
    clearBtn: '[ effacer les clips ]', clearOk: 'clips effacés', captureFail: 'capture refusée ou indisponible',
    exportOk: 'clip prêt — regardez vos téléchargements', statusOn: 'enregistrement', statusOff: 'inactif',
    credit: 'Créé par Harley Vásquez',
  },
  pt: {
    appTitle: 'ScreenLoom', tagline: 'gravador de estúdio para o navegador',
    toggle: '[ iniciar / parar gravação ]', recOn: 'REC', recOff: 'IDLE',
    recChrome: '– a captura roda dentro do popup –', hint: 'clique iniciar, compartilhe aba/janela/tela, a fita corre com um REC vermelho em cada página; parar salva uma ficha de clipe',
    clipsTitle: 'clipes gravados', seqLabel: 'clipes', emptyClips: 'sem clipes ainda — grave o primeiro',
    durLabel: 'duração', mimeLabel: 'mime', nameLabel: 'nome', thumbLabel: 'vista',
    newName: 'novo clipe', downloads: '.webm disponível nesta sessão; a ficha fica salva',
    clearBtn: '[ apagar clipes ]', clearOk: 'clipes apagados', captureFail: 'captura negada ou indisponível',
    exportOk: 'clipe pronto — veja seus downloads', statusOn: 'gravando', statusOff: 'inativo',
    credit: 'Criado por Harley Vásquez',
  },
  it: {
    appTitle: 'ScreenLoom', tagline: 'registratore studio per il browser',
    toggle: '[ avvia / interrompi registrazione ]', recOn: 'REC', recOff: 'IDLE',
    recChrome: '– la cattura gira nel popup –', hint: 'clicca avvia, condividi scheda/finestra/schermo, il nastro gira con un REC rosso su ogni pagina; interrompi salva una scheda clip',
    clipsTitle: 'clip registrati', seqLabel: 'clip', emptyClips: 'nessun clip — registra il primo',
    durLabel: 'durata', mimeLabel: 'mime', nameLabel: 'nome', thumbLabel: 'anteprima',
    newName: 'nuovo clip', downloads: '.webm disponibile in questa sessione; la scheda resta',
    clearBtn: '[ cancella clip ]', clearOk: 'clip cancellati', captureFail: 'cattura negata o non disponibile',
    exportOk: 'clip pronto — guarda i download', statusOn: 'registrando', statusOff: 'inattivo',
    credit: 'Creato da Harley Vásquez',
  },
  de: {
    appTitle: 'ScreenLoom', tagline: 'Studio-Recorder für den Browser',
    toggle: '[ Aufnahme starten / stoppen ]', recOn: 'REC', recOff: 'IDLE',
    recChrome: '– Die Aufnahme läuft im Popup –', hint: 'Klicke starten, teile Tab/Fenster/Bildschirm, das Band läuft mit rotem REC auf jeder Seite; stoppen speichert eine Clip-Karte',
    clipsTitle: 'aufgenommene Clips', seqLabel: 'Clips', emptyClips: 'noch keine Clips — nimm den ersten auf',
    durLabel: 'Dauer', mimeLabel: 'mime', nameLabel: 'Name', thumbLabel: 'Vorschau',
    newName: 'neuer Clip', downloads: '.webm diese Sitzung verfügbar; die Karte bleibt',
    clearBtn: '[ Clips löschen ]', clearOk: 'Clips gelöscht', captureFail: 'Aufnahme verweigert oder nicht verfügbar',
    exportOk: 'Clip fertig — sieh in deinen Downloads nach', statusOn: 'aufnahme', statusOff: 'inaktiv',
    credit: 'Erstellt von Harley Vásquez',
  },
};

const LANGS = Object.keys(I18N);
const LS_KEY = 'sl:lang';

const i18n = {
  current: 'en',
  async getLang() {
    const s = await new Promise((res) => chrome.storage.local.get(LS_KEY, res));
    let v = s[LS_KEY];
    if (!LANGS.includes(v)) v = (navigator.language || 'en').toLowerCase().split('-')[0];
    if (!LANGS.includes(v)) v = 'en';
    return v;
  },
  t(key) {
    return (I18N[this.current] && I18N[this.current][key]) || I18N.en[key] || key;
  },
  apply(root) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (I18N[this.current] && I18N[this.current][k] !== undefined) el.textContent = I18N[this.current][k];
    });
  },
};