# Minesweeper - The Unscripted Stack

A browser Minesweeper game in the classic Windows look. It is plain HTML, CSS, and JavaScript. There is no build step and nothing to install.

## Software requirements

- A current desktop browser: Chrome, Edge, Firefox, or Safari
- JavaScript enabled
- A mouse (or a trackpad that can right-click and middle-click)

Best times are saved in the browser with `localStorage`. Clearing site data resets them.

## How to run

1. Clone this repository.
2. Open `index.html` in your browser.

That is enough. The page loads `style.css` and `game.js` from the same folder, so keep those three files together.

If you prefer a local server:

```bash
# Python 3
python -m http.server 8000
```

Then open `http://localhost:8000`.

## How to play

- Left-click a square to open it. The first opening click is never a mine.
- A number is how many mines touch that square.
- Right-click to flag a mine. Right-click again for a question mark (turn this off under **Game → Marks**).
- On a number, press both mouse buttons, or the middle button, to open the squares around it when your flags match the number.
- Press **F2**, or the face button, to start a new game.

| Difficulty | Board   | Mines |
| ---------- | ------- | ----- |
| Easy       | 9 × 9   | 10    |
| Medium     | 16 × 16 | 40    |
| Difficult  | 16 × 30 | 99    |

Fastest clears are kept under **Game → Best Times**.
