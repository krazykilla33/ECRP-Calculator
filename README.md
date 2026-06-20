# ECRP Calculator

GitHub Pages-ready web app version of the ECRP spreadsheet calculator.

## Upload to GitHub Pages

1. Upload these files to your repository.
2. Go to **Settings → Pages**.
3. Set source to **Deploy from branch**, branch **main**, folder **/root**.
4. Open the GitHub Pages URL.

## Set/Lab Calculator Notes

The Set/Lab calculator now matches the spreadsheet logic more closely:

- The **Open Labs** section controls which labs are currently open.
- The active lab dropdown beside **Lab** is the C5-style selected lab you are cooking at.
- Crack tables can only cook **Crack, Heroin, or XTC/Ecstasy**.
- Coke tables can only cook **Cocaine, LSD, or Meth**.
- Plant tables can only cook **Joint or Seeds**.
- Table totals come from the selected active lab.
- Total drugs, ingredients, cost, value, profit, weight, and per-hour totals update live.

Prices, lab counts, and product data live in `data.js`. Recipes and table restrictions are in `app.js` near the top.
