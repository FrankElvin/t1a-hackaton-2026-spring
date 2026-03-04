
### Regular batch requests
- for each household: get all products that will soon run out for a given household, send a notification
- for each household: get all products having empty `run_out_at.manual` AND `run_out_at.manual` dates, make a request to external service to calculate `run_out_dates` (?)



### GUI-originated requests
- show all products: by user id + request date, get all products and sort by the `run_out_date` descending or ascending, receive only product names and ids, pagination

- get product details: by product id, receive all product details

- save product details: by product id, re-write all data

- show running out products: by user id + request date + days range, get all products that will run out in period between "request date" and "request date + days range"


### data load requests
TBD
