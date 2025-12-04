import requests
import json

url = "https://opendata.cbs.nl/ODataApi/odata/86134NED/TypedDataSet"
params = {"$top": 3}

response = requests.get(url, params=params)
data = response.json()

print("=== RAW RESPONSE ===")
for i, record in enumerate(data['value']):
    print(f"\n--- Record {i+1} ---")
    print(f"Keys: {list(record.keys())}")
    print(json.dumps(record, indent=2))
    if i >= 1:
        break
