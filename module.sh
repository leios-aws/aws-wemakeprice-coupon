#!/bin/sh
NAME=$(basename $(realpath .))
REVISION=$(git describe --all | cut -d '/' -f 2)

rm -f ${NAME}-modules.zip

zip -r ${NAME}-modules.zip nodejs/node_modules && \
    LAYER_VERSION=$(aws lambda publish-layer-version --layer-name ${NAME}-modules --zip-file fileb://${NAME}-modules.zip --compatible-runtimes nodejs10.x | jq -r .LayerVersionArn) && \
    aws lambda update-function-configuration --function-name ${NAME} --layers ${LAYER_VERSION}
