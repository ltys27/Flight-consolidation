#!/usr/bin/env python3
"""Terminal review of due cards with SM-2 scheduling (state in cards/state.json).

    scripts/cards_review.py          # review everything due today
    scripts/cards_review.py --list   # just list what is due
    scripts/cards_review.py --all    # review every card regardless of due date

Grades: 0-2 = forgot (card comes back tomorrow), 3 = hard, 4 = good, 5 = easy.
"""
import argparse
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as c


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--all", action="store_true")
    a = ap.parse_args()
    today = dt.date.today()
    cards = c.load_cards() if a.all else c.due_cards(today)
    cards = [cd for cd in cards if not cd.a.upper().startswith("DRAFT")]
    if a.list or not cards:
        print(f"{len(cards)} card(s) due")
        for cd in cards:
            print(f"- [{cd.section}] {cd.q}")
        return 0
    state = c.load_card_state()
    for i, cd in enumerate(cards, 1):
        print(f"\n[{i}/{len(cards)}] ({cd.section})\nQ: {cd.q}")
        input("   ... press Enter for the answer")
        print(f"A: {cd.a}")
        while True:
            g = input("   grade 0-5 (q to stop): ").strip().lower()
            if g == "q":
                c.save_card_state(state)
                return 0
            if g.isdigit() and 0 <= int(g) <= 5:
                break
        state[cd.id] = c.sm2(state.get(cd.id), int(g), today)
        state[cd.id]["q"] = cd.q[:60]
        print(f"   next due {state[cd.id]['due']}")
    c.save_card_state(state)
    print("\nsaved cards/state.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
