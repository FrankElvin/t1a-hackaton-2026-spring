
### Regular batch processing
- send notifications:
  * for each active household by `user_id`
  * get all products that will soon run out for a given household
  * send a notification

- calculate runout deadline ?:
  * for each active household by `user_id`
  * get all products having empty `run_out_at.deadline` dates
  * make a request to external service to calculate `run_out_at.deadline`
  * update field, fill `run_out_at.type` as `calculated`


### GUI-originated requests
#### household
- show household details: 
  * by: `user_id`
  * get the whole household document
- save household details: 
  * by `user_id`
  * overwrite the household document
- get household consumer categories
  * by `user_id`
  * get all keys from the "consumers" field

#### product
- show all products: 
  * by user id + request date + page size, page number
  * get all products and sort by the `run_out_date` descending or ascending, receive only product names and ids
- get product details: 
  * by product id
  * get the whole product document
- save product details:
  * by product id
  * overwrite the product document
- show running out products:
  * by user id + request date + days range, + page size, page number
  * get all products that will run out in period between "request date" and "request date + days range"


### data load requests
TBD
