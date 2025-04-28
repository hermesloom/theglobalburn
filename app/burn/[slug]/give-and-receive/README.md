# How does "Give and receive" work?

To understand the rest of this section, please familiarize yourself with "embeddings vectors", e.g. as explained [here](https://chatgpt.com/share/67ffe60b-0598-8003-8b78-930472b79876).

In "Give and receive", you have two main buttons: One titled "I have something to give" and one titled "I want something".

If you click on the button "I offer something":

1. A dialogue opens where you can enter what you want to give in free text.
2. Once you submit, what you entered it sent to the server.
3. The embeddings vector of your input is calculated and stored in a vector database titled "offers".
4. The server executes the following prompt using an LLM: `Formulate the following offer (i.e. what someone wants to give) as its counterpart, i.e. the corresponding desire (i.e. what the receiver would ask for to be matched perfectly to the offerer). Output nothing but that desire:` + your input
5. Using the same LLM, the embeddings vector for the output of step 4 is calculated.
6. This embeddings vector is then compared to all others in the vector database titled "desires".
7. The top 50 results are returned, together with the email addresses of the individuals who submitted the respective desires.
