import { usePrompt } from "@/app/_components/PromptContext";
import { useProject } from "@/app/_components/SessionContext";
import { useEffect, useState } from "react";
import { apiGet } from "@/app/_components/api";
import { xor } from "lodash";
import { MenuItem } from "@nextui-org/react";
import { any } from "ajv-ts";

export type BurnerQuestionnaireResult = {
  favorite_principle: string;
};

export const useBurnerQuestionnairePrompt = () => {
  const prompt = usePrompt();
  const { project } = useProject();
  const [listOfQuestions, setListOfQuestions] = useState([]);

  useEffect(() => {
    const fetchQuestions = async () => {
      const questions = await apiGet(`/burn/${project?.slug}/questions`);
      const mappedQuestions = questions.data.map((q: any) => {
        const question = {
          key: q.question_id,
          label: q.question_text,
          type: q.question_type,
          description: q.question_description,
       
        };
        if (q.question_type === "dropdown") {
          question.options = q.question_options?.split("\n").map((z: any) => ({  id: z, label: z }));
        }
        if (q.question_type === "checkbox") {
          question.checkboxes=true;
          question.checkboxoptions = q.question_options?.split("\n").map((z: any) => ({  id: z, label: z }));
        }
        if (q.question_type === "radio") {
          question.radiobuttons=true;
          question.radiooptions = q.question_options?.split("\n").map((z: any) => ({  id: z, label: z }));
        }
        if (q.question_type === "textLong") {
          question.multiLine=true
        }


        
        return question;
      });
      console.log(mappedQuestions);
      setListOfQuestions(mappedQuestions);
    };

    fetchQuestions();
  }, [project?.slug]);

  return () =>
    prompt("First, please answer the following questions.", listOfQuestions);
};
