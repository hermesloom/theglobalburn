import { usePrompt } from "@/app/_components/PromptContext";
import { useProject } from "@/app/_components/SessionContext";
import { useEffect, useState } from "react";
import { apiGet } from "@/app/_components/api";

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
      const mappedQuestions = questions.data.map((q: any) => ({
        key: q.question_id,
        label: q.question_text,
      }));
      console.log(mappedQuestions);
      setListOfQuestions(mappedQuestions);
    };

    fetchQuestions();
  }, [project?.slug]);

  return () =>
    prompt("First, please answer the following burner questioneer.", listOfQuestions);
};
