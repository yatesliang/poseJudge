import tensorflow as tf
from tensorflow import keras

import numpy as np 
import matplotlib.pyplot as plt 
import pandas as pd

import pandas as pd 
def read_data(filepath):
    df = pd.read_csv(filepath)
    # print(df.head)
    resultVector = df['result']
    result = resultVector.values.tolist()
    pos = df[['imageVector', 'videoVector']]
    pos = pos.values.tolist()
    position = [pos[i:i+34] for i in range(0, len(pos),34) ]
    # print(position)
    print(len(position))
    results = []
    # print(result)
    for i in range(len(result)) :
        if i%34 == 0:
            if result[i] < 0.025:
                results.append(1)
            else:
                results.append(0)
    return[position, results]


def plot_image(i, predictions_array, true_label, img):
    predictions_array, true_label, img = predictions_array[i], true_label[i], img[i]
    plt.grid(False)
    plt.xticks([])
    plt.yticks([])
    plt.imshow(img, cmap=plt.cm.binary)
    predicted_label = np.argmax(predictions_array)

    if predicted_label == true_label:
        color = 'blue'
    else:
        color = 'red'

    plt.xlabel("{} {:2.0f}% ({})".format(class_name[predicted_label],
                                100*np.max(predictions_array),
                                class_name[true_label]),
                                color=color)
    
def plot_value_array(i, predictions_array, true_label):
    predictions_array, true_label = predictions_array[i], true_label[i]
    plt.grid(False)
    plt.xticks([])
    plt.yticks([])
    thisplot = plt.bar(range(10), predictions_array, color='#777777')
    plt.ylim([0,1])
    predicted_label = np.argmax(predictions_array)
    thisplot[predicted_label].set_color('red')
    thisplot[true_label].set_color('blue')





print(tf.__version__)

# fashion_mnist = keras.datasets.fashion_mnist
# (train_images, train_labels), (test_images, test_labels) = fashion_mnist.load_data()
# class_name = ['T-Shirt/top', 'Trouser', 'Pullover', 'Dress', 'Coat', 'Sandal', 'Shirt', 'Sneaker', 'Bag', 'Ankle boot']
train_position = []
train_labels = []
for i in range(1,9):
    (pos, labels) = read_data('../data/poseData_%s.csv'%i)
    train_position = train_position + pos
    train_labels = train_labels + labels

test_position = np.array(train_position[0:int(len(train_labels)/5)])
test_labels = np.array(train_labels[0:int(len(train_labels)/5)])
train_position = np.array(train_position[int(len(train_labels)/5):len(train_position)])
train_labels = np.array(train_labels[int(len(train_labels)/5):len(train_labels)])
print(train_position.shape)
print(type(train_position))
print(len(train_labels))
# test_images = test_images / 255.0
# train_images = train_images / 255.0
# plt.figure(figsize=(10,10))
# for i in range(25):
#     plt.subplot(5, 5,i+1)
#     plt.xticks([])
#     plt.yticks([])
#     plt.grid(False)
#     plt.imshow(train_images[i], cmap=plt.cm.binary)
#     plt.xlabel(class_name[train_labels[i]])
# plt.show()


model = keras.Sequential([
    keras.layers.Flatten(input_shape=(34, 2)),
    keras.layers.Dense(128, activation=tf.nn.relu),
    keras.layers.Dense(2, activation=tf.nn.softmax)

])

model.compile(optimizer=tf.keras.optimizers.Adam(), loss='sparse_categorical_crossentropy', metrics=['accuracy'])

model.fit(train_position, train_labels, epochs=3, batch_size=10)
model.save('modelv2.h5')
test_loss, test_acc = model.evaluate(test_position, test_labels)
print('Test accuracy: ', test_acc)
predictions = model.predict(test_position)
print(predictions[0])
print(np.argmax(predictions[0]))

# i= 12
# plt.figure(figsize=(6,3))
# plt.subplot(121)
# plot_image(i,predictions, test_labels, test_images)
# plt.subplot(122)
# plot_value_array(i, predictions, test_labels)
# plt.show()

# img = test_images[0]
# print(img.shape)
# img = (np.expand_dims(img, 0))
# print(img.shape)
# prediction_single = model.predict(img)
# plot_value_array(0, prediction_single, test_labels)
# plt.show()