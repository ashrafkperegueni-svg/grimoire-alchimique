const livre = document.getElementById('livre');
const commandeLivre = document.getElementById('commande-livre');
const formuleEl = document.getElementById('formule');
const historiqueEl = document.getElementById('historique');
const annotationsEl = document.getElementById('annotations');
const pages = livre.querySelectorAll('.page');
const couverture = livre.querySelector('.couverture-frontale');
const maximumChiffres = 15;

let estOuvert = false;
let current = '0';
let previous = null;
let operator = null;
let replaceCurrent = false;
let nbCalculs = 0;
let contexteAudio;
let tamponBruit;
let avertiAudioIndisponible = false;

const operations = {
  '+': { symbole: '+', rune: 'add', calcul: (a, b) => a + b },
  '-': { symbole: '−', rune: 'subtract', calcul: (a, b) => a - b },
  '*': { symbole: '×', rune: 'multiply', calcul: (a, b) => a * b },
  '/': { symbole: '÷', rune: 'divide', calcul: (a, b) => a / b }
};

const annotations = [
  'Cette formule fut employée par Paracelse en 1527...',
  'Note : le mercure doit être purifié sept fois...',
  'Attention à la transmutation du plomb en or...',
  'Le nombre premier est la clé de la pierre philosophale...',
  'Comme en haut, ainsi en bas...',
  "La multiplication est l'union des contraires...",
  'Soustraire, c’est séparer le volatil du fixe...'
];

function changerOuverture() {
  estOuvert = !estOuvert;
  livre.classList.toggle('ouvert', estOuvert);
  commandeLivre.setAttribute('aria-expanded', String(estOuvert));
  commandeLivre.textContent = estOuvert ? 'Refermer le grimoire' : 'Ouvrir le grimoire';

  pages.forEach(page => {
    page.setAttribute('aria-hidden', String(!estOuvert));
    page.toggleAttribute('inert', !estOuvert);
  });

  jouerSon('cuir');
  if (estOuvert) {
    window.setTimeout(() => jouerSon('page'), 320);
  }
}

commandeLivre.addEventListener('click', changerOuverture);
couverture.addEventListener('click', () => {
  if (!estOuvert) {
    changerOuverture();
  }
});

function obtenirContexteAudio() {
  if (contexteAudio) return contexteAudio;
  if (!window.AudioContext) {
    if (!avertiAudioIndisponible) {
      console.warn('Les effets sonores ne sont pas disponibles dans ce navigateur.');
      avertiAudioIndisponible = true;
    }
    return null;
  }

  contexteAudio = new AudioContext();
  return contexteAudio;
}

function jouerTonalite(context, depart, fin, duree, forme, volume) {
  const oscillateur = context.createOscillator();
  const enveloppe = context.createGain();
  const maintenant = context.currentTime;

  oscillateur.type = forme;
  oscillateur.frequency.setValueAtTime(depart, maintenant);
  oscillateur.frequency.exponentialRampToValueAtTime(Math.max(fin, 1), maintenant + duree);
  enveloppe.gain.setValueAtTime(0.0001, maintenant);
  enveloppe.gain.exponentialRampToValueAtTime(volume, maintenant + Math.min(0.025, duree / 3));
  enveloppe.gain.exponentialRampToValueAtTime(0.0001, maintenant + duree);
  oscillateur.connect(enveloppe);
  enveloppe.connect(context.destination);
  oscillateur.start(maintenant);
  oscillateur.stop(maintenant + duree);
}

function jouerSouffle(context, duree, frequenceFiltre, volume, typeFiltre = 'lowpass') {
  if (!tamponBruit) {
    tamponBruit = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const canal = tamponBruit.getChannelData(0);
    for (let index = 0; index < canal.length; index++) {
      canal[index] = Math.random() * 2 - 1;
    }
  }

  const source = context.createBufferSource();
  const filtre = context.createBiquadFilter();
  const enveloppe = context.createGain();
  const maintenant = context.currentTime;

  source.buffer = tamponBruit;
  filtre.type = typeFiltre;
  filtre.frequency.setValueAtTime(frequenceFiltre, maintenant);
  enveloppe.gain.setValueAtTime(0.0001, maintenant);
  enveloppe.gain.exponentialRampToValueAtTime(volume, maintenant + 0.025);
  enveloppe.gain.exponentialRampToValueAtTime(0.0001, maintenant + duree);
  source.connect(filtre);
  filtre.connect(enveloppe);
  enveloppe.connect(context.destination);
  source.start(maintenant);
  source.stop(maintenant + duree);
}

function jouerSon(type) {
  const context = obtenirContexteAudio();
  if (!context) return;

  if (context.state === 'suspended') {
    context.resume().catch(error => console.warn('Impossible d’activer les effets sonores :', error));
  }

  switch (type) {
    case 'cuir':
      jouerTonalite(context, 95, 58, 0.28, 'triangle', 0.055);
      jouerSouffle(context, 0.32, 420, 0.018);
      break;
    case 'page':
      jouerSouffle(context, 0.48, 1500, 0.03, 'bandpass');
      break;
    case 'encre':
      jouerTonalite(context, 180, 55, 0.34, 'sine', 0.06);
      jouerSouffle(context, 0.2, 620, 0.02);
      break;
  }
}

function creerRune(caractere, estOperateur = false) {
  const rune = document.createElement('span');
  rune.classList.add('rune');
  if (estOperateur) rune.classList.add('operateur');
  rune.textContent = { '-': '−', '*': '×', '/': '÷' }[caractere] || caractere;
  return rune;
}

function afficherFormule(texte) {
  const fragment = document.createDocumentFragment();
  let index = 0;

  while (index < texte.length) {
    const caractere = texte[index];
    const operation = operations[caractere];
    const signeExposant = index > 0 && texte[index - 1].toLowerCase() === 'e' && (caractere === '-' || caractere === '+');
    const signeNegatif = caractere === '-' && (index === 0 || '+-*/'.includes(texte[index - 1]));
    if (operation && !signeExposant && !signeNegatif) {
      fragment.appendChild(creerRune(caractere, true));
      index++;
      continue;
    }

    fragment.appendChild(creerRune(signeNegatif ? '−' : caractere));
    index++;
  }

  formuleEl.replaceChildren(fragment);
  formuleEl.setAttribute('aria-label', texte ? `Formule : ${texte}` : 'Formule vide');
}

function afficherExpression() {
  if (previous !== null && operator !== null) {
    afficherFormule(`${previous}${operator}${replaceCurrent ? '' : current}`);
  } else {
    afficherFormule(current);
  }
}

function inputNum(chiffre) {
  const saisieCourante = replaceCurrent ? '0' : current;
  let nouvelleSaisie;

  if (chiffre === '.') {
    if (saisieCourante.includes('.')) return;
    nouvelleSaisie = `${saisieCourante}.`;
  } else if (saisieCourante === '0') {
    nouvelleSaisie = chiffre;
  } else if (saisieCourante === '-0') {
    nouvelleSaisie = `-${chiffre}`;
  } else {
    nouvelleSaisie = `${saisieCourante}${chiffre}`;
  }

  if (nouvelleSaisie.replace(/\D/g, '').length > maximumChiffres) {
    historiqueEl.textContent = `Limite de ${maximumChiffres} chiffres atteinte`;
    return;
  }

  current = nouvelleSaisie;
  replaceCurrent = false;
  historiqueEl.textContent = '';
  afficherExpression();
}

function inputOp(op) {
  if (!operations[op]) return;

  if (operator !== null && !replaceCurrent) {
    if (!calculer()) return;
  }

  if (previous === null) previous = current;
  operator = op;
  replaceCurrent = true;
  afficherExpression();
}

function calculer() {
  if (operator === null || previous === null) return false;

  const valeurAvant = Number(previous);
  const valeurCourante = Number(current);
  const operation = operations[operator];

  if (operator === '/' && valeurCourante === 0) {
    historiqueEl.textContent = 'Erreur : le vide ne divise pas';
    current = '0';
    previous = null;
    operator = null;
    replaceCurrent = true;
    afficherFormule(current);
    jouerSon('encre');
    return false;
  }

  const resultat = operation.calcul(valeurAvant, valeurCourante);
  if (!Number.isFinite(resultat)) {
    historiqueEl.textContent = 'Erreur : résultat hors des limites du grimoire';
    current = '0';
    previous = null;
    operator = null;
    replaceCurrent = true;
    afficherFormule(current);
    jouerSon('encre');
    return false;
  }

  historiqueEl.textContent = `${previous} ${operation.symbole} ${current} =`;
  current = Number(resultat.toPrecision(12)).toString();
  previous = null;
  operator = null;
  replaceCurrent = true;
  afficherFormule(current);
  jouerSon('encre');

  nbCalculs++;
  if (nbCalculs % 3 === 0) {
    const annotation = annotations[(nbCalculs / 3 - 1) % annotations.length];
    const note = document.createElement('p');
    note.textContent = annotation;
    annotationsEl.appendChild(note);
  }

  return true;
}

function changerSigne() {
  if (replaceCurrent) {
    if (operator !== null && previous !== null) current = '0';
    replaceCurrent = false;
  }

  current = current.startsWith('-') ? current.slice(1) : `-${current}`;
  historiqueEl.textContent = '';
  afficherExpression();
}

function appliquerPourcentage() {
  if (replaceCurrent && operator !== null) current = '0';

  const valeurCourante = Number(current);
  const valeurPourcentage = previous !== null && (operator === '+' || operator === '-')
    ? Number(previous) * valeurCourante / 100
    : valeurCourante / 100;

  if (!Number.isFinite(valeurPourcentage)) {
    historiqueEl.textContent = 'Erreur : pourcentage hors des limites du grimoire';
    jouerSon('encre');
    return;
  }

  current = Number(valeurPourcentage.toPrecision(12)).toString();
  replaceCurrent = false;
  historiqueEl.textContent = '';
  afficherExpression();
}

function toutEffacer() {
  current = '0';
  previous = null;
  operator = null;
  replaceCurrent = false;
  afficherExpression();
  historiqueEl.textContent = '';
}

function effacerDernier() {
  if (replaceCurrent) {
    if (operator === null || previous === null) return;
    current = previous;
    previous = null;
    operator = null;
    replaceCurrent = false;
    afficherExpression();
    return;
  }

  if (current.length > 1) {
    current = current.slice(0, -1);
    if (current === '-') current = '0';
  } else {
    current = '0';
  }
  afficherExpression();
  afficherExpression();
}

document.querySelectorAll('.touche').forEach(touche => {
  touche.addEventListener('click', () => {
    if (touche.dataset.num !== undefined) {
      inputNum(touche.dataset.num);
    } else if (touche.dataset.op) {
      inputOp(touche.dataset.op);
    } else if (touche.dataset.action === 'equals') {
      calculer();
    } else if (touche.dataset.action === 'clear') {
      toutEffacer();
    } else if (touche.dataset.action === 'back') {
      effacerDernier();
    } else if (touche.dataset.action === 'sign') {
      changerSigne();
    } else if (touche.dataset.action === 'percent') {
      appliquerPourcentage();
    }
  });
});

document.addEventListener('keydown', event => {
  if (!estOuvert) return;
  const cible = event.target instanceof Element ? event.target : null;
  if (cible && cible.closest('button') && event.key === ' ') return;

  if (/^\d$/.test(event.key)) {
    inputNum(event.key);
  } else if (event.key === '.' || event.key === ',') {
    inputNum('.');
  } else if (operations[event.key]) {
    inputOp(event.key);
  } else if (event.key === 'Enter' || event.key === '=') {
    event.preventDefault();
    calculer();
  } else if (event.key === 'Escape') {
    toutEffacer();
  } else if (event.key === '%') {
    appliquerPourcentage();
  } else if (event.key === 'Backspace') {
    event.preventDefault();
    effacerDernier();
  }
});

afficherExpression();
