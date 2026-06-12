import json, re

with open("meals_raw.json", encoding="utf-8-sig") as f:
    data = json.load(f)

def norm(s): return re.sub(r"[^a-z0-9]", "", s.lower()) if s else ""
def similar(a, b):
    na, nb = norm(a), norm(b)
    if not na or not nb: return 0
    if na == nb: return 1.0
    s, l = (na,nb) if len(na)<=len(nb) else (nb,na)
    if s in l: return 0.9
    def tg(x): return set(x[i:i+3] for i in range(len(x)-2))
    ta,tb = tg(na),tg(nb)
    if not ta or not tb: return 0
    return len(ta&tb)/len(ta|tb)

# Exact (meal_name, week, day) from Excel
EXACT = [
  ("Halloumi Sandwich",1,"saturday"), ("Egg With Zaater",1,"saturday"),
  ("Beetroot Salad",1,"saturday"), ("Sweet Potato Energy Booster",1,"saturday"),
  ("Garlic Butter Chicken",1,"saturday"), ("Chicken Teriyaki Bowl",1,"saturday"),
  ("Chicken Soup",1,"saturday"), ("Beef Kofta Wrap",1,"saturday"), ("Honey Glaze Salmon",1,"saturday"),
  ("Hummus",1,"sunday"), ("Mix Vege Omelette",1,"sunday"), ("Brownies",1,"sunday"),
  ("Caesar Salad",1,"sunday"), ("Chicken Curry",1,"sunday"), ("Beef Balls With Rice",1,"sunday"),
  ("Cinnamon Apple Yogurt",1,"sunday"), ("Spaghetti Bolognese",1,"sunday"), ("Shrimp Tacos",1,"sunday"),
  ("Normal Pancake",1,"monday"), ("Egg Croissant",1,"monday"), ("Lentil Soup",1,"monday"),
  ("Pistachio Salad",1,"monday"), ("Healthy Chicken Majbous",1,"monday"), ("Beef Alfredo",1,"monday"),
  ("Umm Ali",1,"monday"), ("Chicken Shawarma",1,"monday"), ("Chicken Parmesan",1,"monday"),
  ("Sunny Side Egg With Brown Bread",1,"tuesday"), ("Egg Burrito",1,"tuesday"),
  ("Bahamas Lava Cake",1,"tuesday"), ("Crab Salad",1,"tuesday"),
  ("Beef Stroganoff",1,"tuesday"), ("Crispy Chicken Cutlets",1,"tuesday"),
  ("Vegetables Soup",1,"tuesday"), ("Beef Lasagna",1,"tuesday"), ("Southwest Chicken Wrap",1,"tuesday"),
  ("Croissant Cheese",1,"wednesday"), ("Omelette Pizza",1,"wednesday"), ("Date Balls",1,"wednesday"),
  ("Waldorf Salad",1,"wednesday"), ("Dynamite Shrimp",1,"wednesday"), ("Shish Tawook & Rice",1,"wednesday"),
  ("Greek Infusion",1,"wednesday"), ("Chicken Fajita Sandwich",1,"wednesday"), ("Beef Kofta Delight",1,"wednesday"),
  ("Vegetables Soup",1,"wednesday"),
  ("Berry Oatmeal Bowl",1,"thursday"), ("Turkey Cheese Wrap",1,"thursday"), ("Tiramisu",1,"thursday"),
  ("Fruit Salad",1,"thursday"), ("Creamy Garlic Chicken",1,"thursday"), ("New Greek Chicken",1,"thursday"),
  ("Mediterranean Feta Salad",1,"thursday"), ("Beef Shawarma With Beetroot Rice",1,"thursday"),
  ("Salmon Pesto Pasta",1,"thursday"), ("Vegetables Soup",1,"thursday"),
  # Week 2
  ("Chocolate Pancakes",2,"saturday"), ("Oriental Breakfast",2,"saturday"), ("Caesar Salad",2,"saturday"),
  ("Talbina",2,"saturday"), ("Chicken Tacos",2,"saturday"), ("Iranian Chicken",2,"saturday"),
  ("Broccoli Soup",2,"saturday"), ("Beetroot Salad",2,"saturday"),
  ("Salmon No Carb",2,"saturday"), ("Steak Sandwich",2,"saturday"),
  ("Croissant Zaatar",2,"sunday"), ("New Egg Sandwich",2,"sunday"), ("Fruit Salad",2,"sunday"),
  ("Cinnamon Apple Yogurt",2,"sunday"), ("Cordon Bleu",2,"sunday"), ("Fish Sayadieh",2,"sunday"),
  ("Garlic Butter Steak & Potatoes",2,"sunday"), ("Chicken Herbs",2,"sunday"),
  ("Sweet Potato Delight",2,"monday"), ("Mexican Omelette",2,"monday"), ("Mushroom Soup",2,"monday"),
  ("Cookies",2,"monday"), ("Cajun Chicken Pasta",2,"monday"), ("Chicken Vegetables",2,"monday"),
  ("Fattoush",2,"monday"), ("Lentil Soup",2,"monday"), ("Dawoud Basha",2,"monday"), ("Buffalo Chicken Wrap",2,"monday"),
  ("Foul",2,"tuesday"), ("New Egg Shakshouka",2,"tuesday"), ("Chia Seeds Pudding",2,"tuesday"),
  ("Lentil Soup",2,"tuesday"), ("Lemon Chicken",2,"tuesday"), ("Shrimp Curry",2,"tuesday"),
  ("Energy Balls",2,"tuesday"), ("Beef Shawarma Sandwich",2,"tuesday"), ("Iranian Kofta",2,"tuesday"),
  ("Vegetables Soup",2,"tuesday"), ("Corn Soup",2,"tuesday"),
  ("Chocolate Peanut Butter",2,"wednesday"), ("Egg Avocado Toast",2,"wednesday"),
  ("Passion Fruit Quinoa Salad",2,"wednesday"), ("Corn Soup",2,"wednesday"),
  ("Beef Vindalo & Rice",2,"wednesday"), ("Jamaican Jerk Salmon",2,"wednesday"),
  ("Matcha Smoothie Shake",2,"wednesday"), ("Beef Pastrami Sandwich",2,"wednesday"),
  ("Chicken Majbous",2,"wednesday"), ("New Egg Shakshouka",2,"wednesday"),
  ("Caesar Salad",2,"wednesday"), ("Vegetables Soup",2,"wednesday"),
  ("Falafel Wrap",2,"thursday"), ("Lebanese Traditional Muffin",2,"thursday"), ("Rice Pudding",2,"thursday"),
  ("Mediterranean Feta Salad",2,"thursday"), ("Sweet Chili Chicken",2,"thursday"),
  ("Beef Noodles",2,"thursday"), ("Beef Burger",2,"thursday"), ("Chicken Avocado Sandwich",2,"thursday"),
  ("Fruit Salad",2,"thursday"), ("Vegetables Soup",2,"thursday"),
  # Week 3
  ("Egg Muffin",3,"saturday"), ("Normal Pancakes",3,"saturday"), ("Broccoli Soup",3,"saturday"),
  ("Bahamas Lava Cake",3,"saturday"), ("Waldorf Salad",3,"saturday"),
  ("Penne Chicken Pasta",3,"saturday"), ("Beef Kofta With Saffron Rice",3,"saturday"),
  ("Crispy Strips",3,"saturday"), ("Lemon Shrimp",3,"saturday"),
  ("Halloumi Muffin",3,"sunday"), ("Croissant Turkey",3,"sunday"), ("Mushroom Soup",3,"sunday"),
  ("Pistachio Salad",3,"sunday"), ("Chicken Biryani",3,"sunday"), ("Salmon With Salsa",3,"sunday"),
  ("Muffin",3,"sunday"), ("Stuffed Peppers",3,"sunday"), ("Chicken Musakhan",3,"sunday"),
  ("Croissant Egg Ring",3,"monday"), ("Omelette Pizza",3,"monday"),
  ("Passion Fruit Quinoa Salad",3,"monday"), ("Lentil Soup",3,"monday"),
  ("New Roasted Beef Sandwich",3,"monday"), ("Cajun Shrimp Pasta",3,"monday"),
  ("Lazy Cake",3,"monday"), ("Chicken Fattah",3,"monday"), ("Beef Rolls Sweet Potatoes",3,"monday"),
  ("Sunny Side Egg With Brown Bread",3,"tuesday"), ("Chocolate Pancakes",3,"tuesday"),
  ("Crab Salad",3,"tuesday"), ("Corn Soup",3,"tuesday"),
  ("Peri Peri Chicken & Rice",3,"tuesday"), ("Spaghetti Beef Balls",3,"tuesday"),
  ("Tiramisu",3,"tuesday"), ("Turkey Sandwich",3,"tuesday"), ("Shish Tawook Wrap",3,"tuesday"),
  ("Turkey English Muffin",3,"wednesday"), ("New Egg Shakshouka",3,"wednesday"),
  ("Greek Infusion",3,"wednesday"), ("Corn Soup",3,"wednesday"),
  ("Shrimp Majbous",3,"wednesday"), ("Chicken Stroganoff",3,"wednesday"),
  ("Fajita Beef Sandwich",3,"wednesday"), ("Steak With Mashed Potatoes",3,"wednesday"),
  ("Peanut Butter Oatmeal",3,"thursday"), ("Egg Quesadillas",3,"thursday"),
  ("Raspberry Rice Pudding",3,"thursday"), ("Mediterranean Feta Salad",3,"thursday"),
  ("Mongolian Noodles",3,"thursday"), ("Chicken Alfredo",3,"thursday"),
  ("Fruit Salad",3,"thursday"), ("Vegetables Soup",3,"thursday"),
  ("Chicken Tajine",3,"thursday"), ("Grilled Chicken Burger",3,"thursday"),
  # Week 4
  ("Chocolate Pancakes",4,"saturday"), ("Oriental Breakfast",4,"saturday"), ("Caesar Salad",4,"saturday"),
  ("Talbina",4,"saturday"), ("Chicken Tacos",4,"saturday"), ("Iranian Chicken",4,"saturday"),
  ("Broccoli Soup",4,"saturday"), ("Beetroot Salad",4,"saturday"),
  ("Salmon No Carb",4,"saturday"), ("Steak Sandwich",4,"saturday"),
  ("Croissant Zaatar",4,"sunday"), ("New Egg Sandwich",4,"sunday"), ("Fruit Salad",4,"sunday"),
  ("Cinnamon Apple Yogurt",4,"sunday"), ("Cordon Bleu",4,"sunday"), ("Fish Sayadieh",4,"sunday"),
  ("Creamy Zucchini Chicken Pasta",4,"sunday"), ("Chicken Herbs",4,"sunday"),
  ("Sweet Potato Delight",4,"monday"), ("Mexican Omelette",4,"monday"), ("Mushroom Soup",4,"monday"),
  ("Cookies",4,"monday"), ("Cajun Shrimp Pasta",4,"monday"), ("Chicken Vegetables",4,"monday"),
  ("Fattoush",4,"monday"), ("Lentil Soup",4,"monday"), ("Dawoud Basha",4,"monday"), ("Buffalo Chicken Wrap",4,"monday"),
  ("Foul",4,"tuesday"), ("New Egg Shakshouka",4,"tuesday"), ("Chia Seeds Pudding",4,"tuesday"),
  ("Lentil Soup",4,"tuesday"), ("Lemon Chicken",4,"tuesday"), ("Salmon Curry",4,"tuesday"),
  ("Energy Balls",4,"tuesday"), ("Beef Shawarma Sandwich",4,"tuesday"), ("Iranian Kofta",4,"tuesday"),
  ("Vegetables Soup",4,"tuesday"), ("Corn Soup",4,"tuesday"),
  ("Chocolate Peanut Butter",4,"wednesday"), ("Egg Avocado Toast",4,"wednesday"),
  ("Passion Fruit Quinoa Salad",4,"wednesday"), ("Corn Soup",4,"wednesday"),
  ("Beef Vindalo & Rice",4,"wednesday"), ("Chicken Risotto",4,"wednesday"),
  ("Matcha Smoothie Shake",4,"wednesday"), ("Beef Pastrami Sandwich",4,"wednesday"),
  ("Chicken Majbous",4,"wednesday"), ("New Egg Shakshouka",4,"wednesday"),
  ("Caesar Salad",4,"wednesday"), ("Vegetables Soup",4,"wednesday"),
  ("Falafel Wrap",4,"thursday"), ("Lebanese Traditional Muffin",4,"thursday"), ("Rice Pudding",4,"thursday"),
  ("Mediterranean Feta Salad",4,"thursday"), ("Sweet Chili Chicken",4,"thursday"),
  ("Beef Noodles",4,"thursday"), ("Beef Burger",4,"thursday"), ("Chicken Avocado Sandwich",4,"thursday"),
  ("Fruit Salad",4,"thursday"), ("Vegetables Soup",4,"thursday"),
]

# Build meal_name -> set of (week,day) pairs
meal_pairs = {}
for (name, week, day) in EXACT:
    k = norm(name)
    if k not in meal_pairs:
        meal_pairs[k] = {"nameEn": name, "pairs": set()}
    meal_pairs[k]["pairs"].add((week, day))

# Match each schedule entry to best DB meal (greedy by longest name first)
used_ids = set()
result = []  # list of {id, schedule: [{week,day}]}

for k in sorted(meal_pairs.keys(), key=lambda x: -len(x)):
    info = meal_pairs[k]
    best_score, best_meal = 0, None
    for m in data:
        if m["_id"] in used_ids: continue
        sc = similar(info["nameEn"], m.get("nameEn",""))
        if sc > best_score:
            best_score, best_meal = sc, m
    if best_meal and best_score >= 0.4:
        used_ids.add(best_meal["_id"])
        pairs = sorted(info["pairs"])
        result.append({
            "id": best_meal["_id"],
            "schedule": [{"week": w, "day": d} for w,d in pairs],
            "nameEn_sched": info["nameEn"],
            "nameEn_db": best_meal.get("nameEn",""),
            "score": round(best_score,2)
        })

with open("schedule_pairs.json", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"Matched: {len(result)} meals")
# Show a few examples
for r in result[:5]:
    print(f"  {r['nameEn_sched']!r} -> {r['nameEn_db']!r} ({r['score']}) | {len(r['schedule'])} pairs")
