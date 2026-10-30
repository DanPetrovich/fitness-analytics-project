import json
from pathlib import Path

import pandas as pd


SOURCE = Path("/Users/danyapetrovich/Downloads/Онлайн-тренировки, 10 недель.xlsx")
OUTPUT = Path(__file__).with_name("data.js")


def rounded(value, digits=3):
    return None if pd.isna(value) else round(float(value), digits)


views = pd.read_excel(SOURCE, sheet_name=0)
users = pd.read_excel(SOURCE, sheet_name=1)

workouts = (
    views.groupby(["Неделя", "Код тренировки", "Тип", "Тренер"], as_index=False)
    .agg(
        views=("ID просмотра", "count"),
        viewers=("ID пользователя", "nunique"),
        depth=("Глубина", "mean"),
        rating=("Оценка", "mean"),
        ratings=("Оценка", "count"),
        duration=("Длительность", "first"),
    )
    .sort_values(["Неделя", "Код тренировки"])
)

# Когорты фиксируем по терцилям итоговой активности. Границы записаны в данные для прозрачности.
low_cut = int(users["Тренировок"].quantile(1 / 3))
high_cut = int(users["Тренировок"].quantile(2 / 3))


def cohort(value):
    if value <= low_cut:
        return "Низкая"
    if value <= high_cut:
        return "Средняя"
    return "Высокая"


users["cohort"] = users["Тренировок"].map(cohort)
joined = views.merge(users[["ID пользователя", "cohort"]], on="ID пользователя", how="left")
cohort_type = (
    joined.groupby(["cohort", "Неделя", "Тип", "Тренер"], as_index=False)
    .agg(views=("ID просмотра", "count"), viewers=("ID пользователя", "nunique"))
)
cohort_sizes = users.groupby("cohort").size().to_dict()

payload = {
    "meta": {
        "totalViews": int(len(views)),
        "totalUsers": int(views["ID пользователя"].nunique()),
        "totalWorkouts": int(workouts["Код тренировки"].nunique()),
        "cohortCuts": [low_cut, high_cut],
        "cohortSizes": {key: int(value) for key, value in cohort_sizes.items()},
    },
    "workouts": [
        {
            "week": int(row["Неделя"]),
            "code": str(row["Код тренировки"]),
            "type": str(row["Тип"]),
            "trainer": str(row["Тренер"]),
            "views": int(row["views"]),
            "viewers": int(row["viewers"]),
            "depth": rounded(row["depth"], 4),
            "rating": rounded(row["rating"], 3),
            "ratings": int(row["ratings"]),
            "duration": rounded(row["duration"], 1),
        }
        for _, row in workouts.iterrows()
    ],
    "cohortType": [
        {
            "cohort": str(row["cohort"]),
            "week": int(row["Неделя"]),
            "type": str(row["Тип"]),
            "trainer": str(row["Тренер"]),
            "views": int(row["views"]),
            "viewers": int(row["viewers"]),
        }
        for _, row in cohort_type.iterrows()
    ],
}

OUTPUT.write_text("window.FITNESS_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(json.dumps(payload["meta"], ensure_ascii=False, indent=2))
print(f"Generated {OUTPUT} with {len(payload['workouts'])} workout particles")
