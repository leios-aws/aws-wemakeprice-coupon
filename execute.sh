#!/bin/sh
NAME=$(basename $(realpath .))
aws lambda invoke --function-name ${NAME} --log-type Tail --payload '{"key1":"value1", "key2":"value2", "key3":"value3"}' output.log | jq -r .LogResult | base64 --decode