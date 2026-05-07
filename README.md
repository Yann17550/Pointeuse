# PointageGPS RH 📍

Application PWA (Progressive Web App) sécurisée de pointage des employés avec GPS, biométrie et synchronisation Google Sheets.

## 🎯 Fonctionnalités

✅ **Login sécurisé**
- PIN 4 chiffres
- Authentification biométrique (empreinte digitale / reconnaissance faciale)

✅ **Pointage GPS**
- Capture automatique de la position GPS
- Précision de localisation affichée
- Reverse geocoding (adresse)

✅ **Synchronisation sécurisée**
- Envoi des données via Google Apps Script
- Stockage dans Google Sheets
- Chiffrement des données sensibles

✅ **Application distribuée**
- Fonctionne hors ligne (mode dégradé)
- Synchronisation automatique quand connexion revient
- Installable sur l'écran d'accueil (PWA)

✅ **Multi-employés**
- Chaque employé a son PIN unique
- Historique personnalisé
- Données séparées par employé

## 🚀 Déploiement rapide

### 1. GitHub Pages (Recommandé)

```bash
# Clonez le repo
git clone https://github.com/votre-nom/pointage-gps.git
cd pointage-gps

# Poussez sur GitHub
git push origin main
```

Allez à **Settings → Pages → Deploy from a branch → main**

L'app sera disponible à : `https://votre-nom.github.io/pointage-gps/`

### 2. Autre hébergement (Vercel, Netlify, etc.)

- Importez le repo
- Déploiement automatique
- L'app fonctionnera au même titre

## 🔐 Configuration

### API Google Apps Script

L'URL de l'API est configurée dans `script.js` :

```javascript
const API_URL = 'https://script.google.com/macros/s/AKfycbyw4sHgjtbMzRxy1swvqt0J4QrBNIyvwflqiuQN-K1NJn2KULcAHX_gWk0N3APJhdS71w/exec';
```

**⚠️ Important** : Ne partagez pas cette URL publiquement sur GitHub !

### Employés

Modifiez les employés dans `script.js` :

```javascript
const EMPLOYEES = {
  '0001': { name: 'Yann Test1', email: 'yannphonne72@gmail.com' },
  '0002': { name: 'Laure test2', email: 'millebulle@gmail.com' },
};
```

## 📱 Utilisation

### Pour les employés

1. **Ouverture**
   - Scannez le QR code ou cliquez sur le lien
   - Ouvrez sur votre téléphone

2. **Login**
   - Entrez votre PIN 4 chiffres
   - Optionnel : enregistrez votre empreinte

3. **Pointage**
   - Cliquez "🟢 Arrivée" à l'arrivée
   - Cliquez "🔴 Départ" au départ
   - Permettez l'accès au GPS quand demandé

4. **Installation (optionnel)**
   - Cliquez "Ajouter à l'écran d'accueil"
   - L'app fonctionne même hors ligne

### Pour l'admin RH

- Consultez directement la Google Sheet "Pointages RH"
- Chaque entrée contient :
  - Timestamp complet
  - Nom et email de l'employé
  - Heure du pointage
  - Coordonnées GPS exactes
  - Adresse (reverse geocoding)
  - Précision de localisation

## 🛠️ Architecture

```
Frontend (GitHub Pages)
    ↓
    ├── index.html (interface PWA)
    ├── script.js (logique, GPS, biométrie)
    ├── sw.js (Service Worker, offline)
    ├── manifest.json (installation)
    └── README.md (documentation)
    
    ↓ HTTPS POST
    
Backend (Google Apps Script)
    ↓
Google Sheets "Pointages RH"
```

## 🔒 Sécurité

- **PIN local** : Validé côté frontend + backend
- **Biométrie** : WebAuthn API (empreinte/reconnaissance faciale)
- **GPS** : Donnée brute + précision affichée
- **HTTPS** : Communication chiffrée
- **Aucune clé API** sur GitHub (API URL unique)

## 📊 Données capturées

| Champ | Description |
|-------|-------------|
| Timestamp | Date/heure exact de l'enregistrement |
| Employé | Nom et email |
| Type | "Arrivée" ou "Départ" |
| Heure | Heure du pointage |
| GPS | Latitude, longitude, précision |
| Adresse | Adresse reverse-geocodée |

## 🔄 Synchronisation

- **Mode connecté** : Envoi immédiat à Google Sheets
- **Mode hors ligne** : Stockage local (IndexedDB/LocalStorage)
- **Reconnexion** : Synchronisation automatique

## 📝 Fichiers

- `index.html` - Interface complète (PWA)
- `script.js` - Logique JS (PIN, GPS, API, biométrie)
- `manifest.json` - Configuration PWA
- `sw.js` - Service Worker (offline)
- `apps-script.gs` - Backend Google Apps Script *(déployer séparément)*
- `README.md` - Cette doc

## 🚦 Prochaines étapes

- [ ] Dashboard RH (voir en temps réel les pointages)
- [ ] Détection du WiFi du restaurant (confirmation additionnelle)
- [ ] Interface d'admin pour gérer les employés
- [ ] Statistiques par employé (heures travaillées, retards)
- [ ] Export CSV/Excel

## 📞 Support

Pour des questions ou problèmes :
1. Vérifiez l'URL de l'API Apps Script
2. Vérifiez les PINs dans `script.js`
3. Activez le GPS sur votre téléphone
4. Acceptez les permissions de géolocalisation

## 📄 Licence

Propriétaire - Usage interne uniquement

---

**Développé avec ❤️ pour votre restaurant**
