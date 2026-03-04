
## database info

database name: `never_empty`


## collections
#### household
indexes (one per `-` item): 
 - for loading user details:
   * `user_id` (unique)
 - for loading records for updates:
   * active
   * lock.locked
   * lock.until

#### product
indexes (one per `-` item):
 - for accessing household products by `user_id`
   * `user_id`
   * `run_out_at.deadline` ascending
