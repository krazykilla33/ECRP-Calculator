# ECRP Calculator Web App

This is a static GitHub Pages starter app converted from `ECRP Calculator.xlsx`.

## How to use with GitHub Pages

1. Create a new GitHub repository, for example `ecrp-calculator`.
2. Upload these files to the repository root:
   - `index.html`
   - `style.css`
   - `app.js`
   - `data.js`
3. In GitHub, go to **Settings > Pages**.
4. Under **Build and deployment**, choose:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/root**
5. Save. GitHub will give you a live link like:
   `https://YOURUSERNAME.github.io/ecrp-calculator/`

## Updating prices or labs

Edit `data.js` directly in GitHub. That file contains:

- Product price tiers
- Default quantities
- Bonus percentages
- Labs and table counts
- Set product costs and values
- Cook times

## Notes

This version runs entirely in the browser, so no server or database is required. User-entered values are saved locally in the browser using `localStorage`.
