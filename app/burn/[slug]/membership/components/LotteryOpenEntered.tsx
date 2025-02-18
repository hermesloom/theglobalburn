"use client";

import React, { useState } from "react";
import { Alert, Button } from "@nextui-org/react";
import { apiDelete } from "@/app/_components/api";
import { useProject } from "@/app/_components/SessionContext";
import toast from "react-hot-toast";
import MemberDetails from "./helpers/MemberDetails";
import ActionButton from "@/app/_components/ActionButton";
import { usePrompt } from "@/app/_components/PromptContext";

export default function LotteryOpenEntered() {
  const { project, updateProjectSimple } = useProject();
  const [isLoading, setIsLoading] = useState(false);
   const prompt = usePrompt();
  return (
    <div className="flex flex-col gap-4">
      <Alert color="warning" title="Important!">
        <span>
          You will not receive any emails about the lottery on whether you won
          or not. Instead, on{" "}
          <b>
            {new Date(project?.burn_config.lottery_closes_at!).toLocaleString()}
          </b>
          , please check this page again to see whether you won. Mark it in your
          calendar to not miss it!
        </span>
      </Alert>
      <MemberDetails data={project?.lottery_ticket!} />
      <div className="flex flex-col gap-2">
        <Button color="success" isDisabled>
          You have successfully entered the lottery!
        </Button>
        
        


        <ActionButton
          color="danger"
         
          
          action={{
            key: "leave-lottery",
            label: "Click here if you want to leave the lottery",
            onClick: {
              prompt: () =>
                prompt(
                  "You are about to leave the lottery Are you absolutely sure?",
                  [
                    {
                      key: "confirmReturn",
                      label: "Type in: I WANT TO LEAVE",
                      validate: (finalConfirm) =>
                        finalConfirm == "I WANT TO LEAVE",
                    },
                  ]
                ),
              handler: async (_, promptData) => {
                setIsLoading(true);
            

            try {


              await apiDelete(`/burn/${project?.slug}/lottery-ticket`);
              updateProjectSimple({
                lottery_ticket: undefined,
              });
              toast.success("You have left the lottery!");

              
            } finally {
              setIsLoading(false);
            }
               
                return true;
              },
            },
          }}
        />


      </div>
    </div>
  );
}
